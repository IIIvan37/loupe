//! `POST /download` — the NDJSON contract the web `http-track-source`
//! adapter speaks, backed by the shared `loupe-download` engine (D4.a):
//!
//! ```text
//! POST /download        body = {"url": "..."} (application/json)
//!   -> 200 application/x-ndjson, streamed line by line:
//!        {"type":"progress","phase":"downloading"|"transcoding","fraction":0..1}
//!        {"type":"done","ref","title","duration"?,"uploader"?}   (last line)
//!        {"type":"error","code","message"}                       (on failure)
//!
//! The error `code` (`unsupported` | `timeout` | `extractor-stale` |
//! `store-quota` | `unknown`) is the UI contract (AV.1): the client maps it to
//! translated copy and keeps `message` for the console.
//! ```
//!
//! The engine is a seam (`DownloadEngine`) so tests drive the route with a
//! fake; the binary wires `loupe_download::download_track`. The fetched audio
//! is parked in the SAME content-addressed `/audio` store the project blobs
//! use, so the web client resolves the bytes with a plain `GET /audio/{ref}`
//! — never a forked second store.

use crate::audio_store::{StoreError, QUOTA_MESSAGE};
use crate::AppState;
use axum::body::{Body, Bytes};
use axum::extract::State;
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use loupe_download::{DownloadError, DownloadedTrack, ProgressFn};
use std::future::Future;
use std::path::PathBuf;
use std::pin::Pin;
use std::sync::Arc;
use tokio::sync::mpsc::UnboundedSender;
use tokio::sync::Notify;
use tokio_stream::wrappers::UnboundedReceiverStream;
use tokio_stream::StreamExt;

pub type TrackFuture = Pin<Box<dyn Future<Output = Result<DownloadedTrack, DownloadError>> + Send>>;

/// The download seam: same signature as `loupe_download::download_track`,
/// object-safe so the route can be exercised with a fake engine.
pub trait DownloadEngine: Send + Sync {
  fn download(
    &self,
    data_dir: PathBuf,
    url: String,
    on_progress: Arc<ProgressFn>,
    cancel: Arc<Notify>,
  ) -> TrackFuture;
}

/// The real engine — the one shared implementation of D4.a.
pub struct YtDlpEngine;

impl DownloadEngine for YtDlpEngine {
  fn download(
    &self,
    data_dir: PathBuf,
    url: String,
    on_progress: Arc<ProgressFn>,
    cancel: Arc<Notify>,
  ) -> TrackFuture {
    Box::pin(
      async move { loupe_download::download_track(&data_dir, &url, on_progress, cancel).await },
    )
  }
}

/// Notifies the engine's cancel handle when the response stream is dropped —
/// a client that disconnects mid-download kills its own yt-dlp child instead
/// of leaving it running to completion for nobody.
struct CancelOnDrop(Arc<Notify>);

impl Drop for CancelOnDrop {
  fn drop(&mut self) {
    self.0.notify_waiters();
  }
}

fn line(payload: serde_json::Value) -> String {
  format!("{payload}\n")
}

/// The NDJSON error line: the `code` is what the client's copy switches on,
/// the raw English `message` is console-only material.
fn error_line(code: &str, message: &str) -> serde_json::Value {
  serde_json::json!({"type": "error", "code": code, "message": message})
}

fn send(events: &UnboundedSender<String>, payload: serde_json::Value) {
  // A closed channel just means the client is gone — nothing to report to.
  let _ = events.send(line(payload));
}

pub async fn download(State(state): State<Arc<AppState>>, body: Bytes) -> Response {
  let Ok(parsed) = serde_json::from_slice::<serde_json::Value>(&body) else {
    return (StatusCode::BAD_REQUEST, "body is not JSON").into_response();
  };
  let url = parsed
    .get("url")
    .and_then(|value| value.as_str())
    .unwrap_or("")
    .to_owned();

  let (events, receiver) = tokio::sync::mpsc::unbounded_channel::<String>();
  let cancel = Arc::new(Notify::new());
  tokio::spawn(run_download(state, url, events, cancel.clone()));

  // The HTTP 200 is committed up front (streaming): every later refusal —
  // engine failure, store quota, timeout — arrives as an NDJSON error line,
  // never a dead stream or a late status change.
  let guard = CancelOnDrop(cancel);
  let stream = UnboundedReceiverStream::new(receiver).map(move |chunk| {
    let _keep_alive = &guard;
    Ok::<_, std::convert::Infallible>(Bytes::from(chunk))
  });
  (
    [(header::CONTENT_TYPE, "application/x-ndjson")],
    Body::from_stream(stream),
  )
    .into_response()
}

async fn run_download(
  state: Arc<AppState>,
  url: String,
  events: UnboundedSender<String>,
  cancel: Arc<Notify>,
) {
  let progress_events = events.clone();
  let on_progress: Arc<ProgressFn> = Arc::new(move |phase, fraction| {
    let _ = progress_events.send(line(
      serde_json::json!({"type": "progress", "phase": phase, "fraction": fraction}),
    ));
  });

  // One wall-clock budget for the whole run, queue wait included — parity
  // with the Python stream's single deadline (a trickle does not re-arm it).
  let work = async {
    // yt-dlp holds a network pipe (and on the ffmpeg fallback a CPU): N
    // parallel downloads would also fill the temp dir N times over. One at a
    // time by default, env-tunable — same policy as the Python semaphore.
    let Ok(_permit) = state.download_slots.acquire().await else {
      return None;
    };
    if events.is_closed() {
      return None; // the client left while we were queued — skip the fetch
    }
    Some(
      state
        .engine
        .download(state.config.data_dir.clone(), url, on_progress, cancel)
        .await,
    )
  };
  match tokio::time::timeout(state.config.download_timeout, work).await {
    Err(_) => send(&events, error_line("timeout", "download timed out")),
    Ok(None) => {}
    Ok(Some(Err(error))) => send(&events, error_line(error.code.as_str(), &error.message)),
    Ok(Some(Ok(track))) => match park(&state, &track).await {
      Ok(done) => send(&events, done),
      Err((code, message)) => send(&events, error_line(code, &message)),
    },
  }
}

/// Move the fetched file into the content-addressed store and build the
/// `done` event; the per-download temp dir goes away either way. A failure is
/// `(code, message)` — the store quota is the one case the user can act on.
async fn park(
  state: &Arc<AppState>,
  track: &DownloadedTrack,
) -> Result<serde_json::Value, (&'static str, String)> {
  let audio_path = state.config.data_dir.join(&track.relative_path);
  let temp_dir = audio_path.parent().map(PathBuf::from);
  let store = state.store.clone();
  let stored = tokio::task::spawn_blocking(move || {
    let bytes = std::fs::read(&audio_path)
      .map_err(|e| ("unknown", format!("downloaded file unreadable: {e}")))?;
    store.store(&bytes).map_err(|error| match error {
      StoreError::QuotaExceeded => ("store-quota", QUOTA_MESSAGE.to_owned()),
      StoreError::Io(message) => ("unknown", format!("audio store error: {message}")),
    })
  })
  .await
  .map_err(|e| ("unknown", format!("audio store task failed: {e}")));
  if let Some(dir) = temp_dir {
    let _ = tokio::fs::remove_dir_all(dir).await;
  }
  let reference = stored??;

  let mut done = serde_json::json!({
    "type": "done",
    "ref": reference,
    "title": track.title,
  });
  if let Some(duration) = track.duration_seconds {
    done["duration"] = duration.into();
  }
  if let Some(uploader) = track.uploader.as_deref().filter(|u| !u.is_empty()) {
    done["uploader"] = uploader.into();
  }
  Ok(done)
}
