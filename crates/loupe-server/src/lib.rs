//! Local server for loupe, route 2 (distribution D4.b): one static binary
//! that serves the embedded web app and the localhost API around it. The
//! calculation stays on Modal — this server only serves the UI, downloads
//! tracks (via the shared `loupe-download` crate) and stores blobs and
//! project manifests (D4.c).
//!
//! The trust model is `server/app/main.py`'s, guard for guard: CORS <
//! OriginGuard < TrustedHost < LoopbackOnly (innermost first), so a request
//! is vetted network-first before CORS ever sees it.

pub mod audio_store;
pub mod config;
pub mod download;
mod fs_atomic;
pub mod netguard;
pub mod project_store;
pub mod static_web;
pub mod version_check;

use audio_store::{AudioStore, StoreError, QUOTA_MESSAGE};
use axum::body::Body;
use axum::extract::{DefaultBodyLimit, Path, State};
use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Json, Response};
use axum::routing::{get, post};
use axum::Router;
use config::Config;
use download::DownloadEngine;
use project_store::{ProjectError, ProjectStore};
use std::sync::Arc;
use tokio::sync::Semaphore;
use tokio_util::io::ReaderStream;
use tower_http::cors::{Any, CorsLayer};

pub struct AppState {
  pub config: Config,
  pub store: AudioStore,
  pub projects: ProjectStore,
  pub engine: Arc<dyn DownloadEngine>,
  pub download_slots: Semaphore,
}

pub fn build_app(config: Config, engine: Arc<dyn DownloadEngine>) -> Router {
  let store = AudioStore::new(&config.data_dir, config.max_audio_store_bytes);
  let projects = ProjectStore::new(&config.data_dir);
  let guard_config = Arc::new(config.clone());
  let cors = CorsLayer::new()
    .allow_origin(
      config
        .allowed_origins
        .iter()
        .filter_map(|origin| origin.parse::<HeaderValue>().ok())
        .collect::<Vec<_>>(),
    )
    .allow_methods(Any)
    .allow_headers(Any);
  let state = Arc::new(AppState {
    store,
    projects,
    engine,
    download_slots: Semaphore::new(config.download_slots),
    config,
  });

  Router::new()
    .route("/health", get(health))
    .route("/version", get(version))
    .route(
      "/audio",
      post(upload_audio).layer(DefaultBodyLimit::max(
        state.config.max_upload_bytes as usize,
      )),
    )
    .route("/audio/{ref}", get(get_audio))
    .route("/projects", get(list_projects))
    .route(
      "/projects/{id}",
      get(get_project)
        .put(save_project)
        .delete(delete_project)
        .layer(DefaultBodyLimit::max(
          state.config.max_manifest_bytes as usize,
        )),
    )
    .route("/gc", post(run_gc))
    .route(
      "/download",
      post(download::download).layer(DefaultBodyLimit::max(
        state.config.max_manifest_bytes as usize,
      )),
    )
    .fallback(static_web::serve)
    .with_state(state)
    // Middleware onion, innermost first — last layer added = outermost, so a
    // request is vetted loopback → Host → Origin → CORS, like the Python app.
    .layer(cors)
    .layer(axum::middleware::from_fn_with_state(
      guard_config.clone(),
      netguard::origin_guard,
    ))
    .layer(axum::middleware::from_fn_with_state(
      guard_config,
      netguard::trusted_host,
    ))
    .layer(axum::middleware::from_fn(netguard::loopback_only))
}

/// Parity shape with the Python `/health`: this binary never carries the ML
/// stack, so the separation fields are always null (analyses run on Modal).
async fn health() -> Json<serde_json::Value> {
  Json(serde_json::json!({"status": "ok", "model": null, "device": null}))
}

/// The binary's own version, so the web app can put it in bug reports —
/// kept out of `/health`, whose shape is frozen by the Python parity.
async fn version() -> Json<serde_json::Value> {
  Json(serde_json::json!({"version": env!("CARGO_PKG_VERSION")}))
}

async fn upload_audio(
  State(state): State<Arc<AppState>>,
  body: axum::body::Bytes,
) -> Result<Response, Response> {
  let store = state.store.clone();
  Ok(match blocking(move || store.store(&body)).await? {
    Ok(reference) => Json(serde_json::json!({"ref": reference})).into_response(),
    Err(StoreError::QuotaExceeded) => {
      (StatusCode::INSUFFICIENT_STORAGE, QUOTA_MESSAGE).into_response()
    }
    Err(StoreError::Io(message)) => (StatusCode::INTERNAL_SERVER_ERROR, message).into_response(),
  })
}

async fn get_audio(State(state): State<Arc<AppState>>, Path(reference): Path<String>) -> Response {
  let not_found = || (StatusCode::NOT_FOUND, "unknown audio ref").into_response();
  let Some(path) = state.store.blob_path(&reference) else {
    return not_found();
  };
  let Ok(file) = tokio::fs::File::open(&path).await else {
    return not_found();
  };
  let Ok(metadata) = file.metadata().await else {
    return not_found();
  };
  // Streamed from disk — a blob runs to hundreds of MB, and reading it whole
  // would buffer all of it per request (same stance as the Python
  // FileResponse).
  (
    [
      (header::CONTENT_TYPE, "application/octet-stream".to_owned()),
      (header::CONTENT_LENGTH, metadata.len().to_string()),
    ],
    Body::from_stream(ReaderStream::new(file)),
  )
    .into_response()
}

/// Run a blocking store closure off the async runtime, 500 on a lost worker.
async fn blocking<T: Send + 'static>(
  task: impl FnOnce() -> T + Send + 'static,
) -> Result<T, Response> {
  tokio::task::spawn_blocking(task)
    .await
    .map_err(|join_error| {
      (StatusCode::INTERNAL_SERVER_ERROR, join_error.to_string()).into_response()
    })
}

/// The one place a `ProjectError` becomes an HTTP status (Python parity:
/// 404 "unknown project", 400 "manifest is not JSON", 500 otherwise).
fn project_error(error: ProjectError) -> Response {
  match error {
    ProjectError::UnknownProject => (StatusCode::NOT_FOUND, "unknown project").into_response(),
    ProjectError::NotJson => (StatusCode::BAD_REQUEST, "manifest is not JSON").into_response(),
    ProjectError::Io(message) => (StatusCode::INTERNAL_SERVER_ERROR, message).into_response(),
  }
}

async fn list_projects(State(state): State<Arc<AppState>>) -> Result<Response, Response> {
  let store = state.projects.clone();
  let manifests = blocking(move || store.list()).await?;
  Ok(Json(manifests).into_response())
}

async fn get_project(
  State(state): State<Arc<AppState>>,
  Path(id): Path<String>,
) -> Result<Response, Response> {
  let store = state.projects.clone();
  let manifest = blocking(move || store.load(&id))
    .await?
    .map_err(project_error)?;
  // The manifest is persisted verbatim, so it is served verbatim too.
  Ok(([(header::CONTENT_TYPE, "application/json")], manifest).into_response())
}

async fn save_project(
  State(state): State<Arc<AppState>>,
  Path(id): Path<String>,
  body: axum::body::Bytes,
) -> Result<Response, Response> {
  let store = state.projects.clone();
  blocking(move || store.save(&id, &body))
    .await?
    .map_err(project_error)?;
  Ok(StatusCode::NO_CONTENT.into_response())
}

async fn delete_project(
  State(state): State<Arc<AppState>>,
  Path(id): Path<String>,
) -> Result<Response, Response> {
  let store = state.projects.clone();
  blocking(move || store.delete(&id))
    .await?
    .map_err(project_error)?;
  Ok(StatusCode::NO_CONTENT.into_response())
}

/// Sweep orphaned audio blobs. Idempotent; safe to call when idle.
async fn run_gc(State(state): State<Arc<AppState>>) -> Result<Response, Response> {
  let projects = state.projects.clone();
  let audio = state.store.clone();
  let summary = blocking(move || project_store::collect_garbage(&projects, &audio)).await?;
  Ok(Json(summary).into_response())
}

/// Make the storage root private to the user (AW.2, the Python stems store's
/// 0700 brought to `~/.loupe`): created 0700 on a fresh install, tightened on
/// an existing one — every blob and manifest inside stops being world-listable
/// in one chmod, whatever mode the wheel era left files in.
pub fn ensure_private_data_dir(config: &Config) -> std::io::Result<()> {
  fs_atomic::create_private_dir_all(&config.data_dir)?;
  fs_atomic::make_private_dir(&config.data_dir)
}

/// Boot-time GC, parity with the Python lifespan hook: the one moment nothing
/// is in flight, so a blob uploaded but not yet named by a saved manifest can
/// never be mistaken for an orphan — which is why no HTTP client calls `/gc`
/// itself. Best-effort by construction (a skipped or empty sweep is a valid
/// summary, never an error).
pub fn boot_gc(config: &Config) -> serde_json::Value {
  let projects = ProjectStore::new(&config.data_dir);
  let audio = AudioStore::new(&config.data_dir, config.max_audio_store_bytes);
  project_store::collect_garbage(&projects, &audio)
}
