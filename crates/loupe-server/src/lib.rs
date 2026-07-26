//! Local server for loupe, route 2 (distribution D4.b): one static binary
//! that serves the embedded web app and the localhost API around it. The
//! calculation stays on Modal — this server only serves the UI, downloads
//! tracks (via the shared `loupe-download` crate) and stores blobs; project
//! manifests follow in D4.c.
//!
//! The trust model is `server/app/main.py`'s, guard for guard: CORS <
//! OriginGuard < TrustedHost < LoopbackOnly (innermost first), so a request
//! is vetted network-first before CORS ever sees it.

pub mod audio_store;
pub mod config;
pub mod download;
pub mod netguard;
pub mod static_web;

use audio_store::{AudioStore, StoreError, QUOTA_MESSAGE};
use axum::body::Body;
use axum::extract::{DefaultBodyLimit, Path, State};
use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Json, Response};
use axum::routing::{get, post};
use axum::Router;
use config::Config;
use download::DownloadEngine;
use std::sync::Arc;
use tokio::sync::Semaphore;
use tokio_util::io::ReaderStream;
use tower_http::cors::{Any, CorsLayer};

pub struct AppState {
  pub config: Config,
  pub store: AudioStore,
  pub engine: Arc<dyn DownloadEngine>,
  pub download_slots: Semaphore,
}

pub fn build_app(config: Config, engine: Arc<dyn DownloadEngine>) -> Router {
  let store = AudioStore::new(&config.data_dir, config.max_audio_store_bytes);
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
    engine,
    download_slots: Semaphore::new(config.download_slots),
    config,
  });

  Router::new()
    .route("/health", get(health))
    .route(
      "/audio",
      post(upload_audio).layer(DefaultBodyLimit::max(
        state.config.max_upload_bytes as usize,
      )),
    )
    .route("/audio/{ref}", get(get_audio))
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

async fn upload_audio(State(state): State<Arc<AppState>>, body: axum::body::Bytes) -> Response {
  let store = state.store.clone();
  match tokio::task::spawn_blocking(move || store.store(&body)).await {
    Ok(Ok(reference)) => Json(serde_json::json!({"ref": reference})).into_response(),
    Ok(Err(StoreError::QuotaExceeded)) => {
      (StatusCode::INSUFFICIENT_STORAGE, QUOTA_MESSAGE).into_response()
    }
    Ok(Err(StoreError::Io(message))) => {
      (StatusCode::INTERNAL_SERVER_ERROR, message).into_response()
    }
    Err(join_error) => (StatusCode::INTERNAL_SERVER_ERROR, join_error.to_string()).into_response(),
  }
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
