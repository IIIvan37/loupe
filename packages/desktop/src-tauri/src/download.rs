//! Import-from-URL, Tauri side (T2.3 → D4.a): the engine — managed yt-dlp
//! binary, guards, progress, cancellation — lives in the shared
//! `loupe-download` crate (one implementation for this shell and the `loupe`
//! server binary). This module is the thin adapter: resolve the app-data dir,
//! bridge progress onto the webview `Channel`, keep the one-at-a-time slot.

use loupe_download::{DownloadedTrack, ProgressFn};
use serde::Serialize;
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::Manager;
use tokio::sync::{Mutex, Notify};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum ProgressEvent {
  #[serde(rename = "progress")]
  Progress { phase: &'static str, fraction: f64 },
}

/// One download at a time (the server holds a BoundedSemaphore(1) the same
/// way). Holds the cancel signal for the in-flight download so
/// `cancel_download` can ask it to kill its own `Child` — no raw pid, so no
/// chance of signalling a process that reused the pid after we finished.
#[derive(Default)]
pub struct DownloadState {
  cancel: Mutex<Option<Arc<Notify>>>,
}

/// Run the download inside the shared engine, streaming progress to the
/// webview. Returns the produced audio file (relative to app-data — the
/// webview reads it back through the fs plugin, which is scoped to app-data)
/// plus the metadata yt-dlp wrote next to it.
#[tauri::command]
pub async fn download_track(
  app: tauri::AppHandle,
  state: tauri::State<'_, DownloadState>,
  url: String,
  on_progress: Channel<ProgressEvent>,
) -> Result<DownloadedTrack, String> {
  let cancel = Arc::new(Notify::new());
  {
    let mut slot = state.cancel.lock().await;
    if slot.is_some() {
      return Err("a download is already running".into());
    }
    *slot = Some(cancel.clone());
  }
  let data_dir = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("app data dir unavailable: {e}"));
  let outcome = match data_dir {
    Err(e) => Err(e),
    Ok(data_dir) => {
      let progress: Arc<ProgressFn> = Arc::new(move |phase, fraction| {
        let _ = on_progress.send(ProgressEvent::Progress { phase, fraction });
      });
      loupe_download::download_track(&data_dir, &url, progress, cancel).await
    }
  };
  *state.cancel.lock().await = None;
  outcome
}

/// Ask the in-flight download (if any) to kill its own child. The webview
/// treats the resulting command rejection as a stale run (run-token pattern),
/// never an error.
#[tauri::command]
pub async fn cancel_download(state: tauri::State<'_, DownloadState>) -> Result<(), String> {
  if let Some(cancel) = state.cancel.lock().await.as_ref() {
    cancel.notify_one();
  }
  Ok(())
}
