//! Native file export (AH follow-up), in two steps so the save dialog opens
//! INSTANTLY: `pick_export_path` (tiny payload → native dialog, the chosen
//! path stays in Rust behind an opaque token) then `write_export` (the bytes
//! ride the IPC — ~8 MB/s in the bundled webview, so the dialog must never
//! wait behind them — and Rust writes to the token's path). The webview
//! never names a filesystem path, and keeps ZERO write access outside
//! app-data (AC.2 deny scope untouched).

use std::path::PathBuf;
use tauri::ipc::{InvokeBody, Request};
use tauri_plugin_dialog::DialogExt;
use tokio::sync::Mutex;

/// The header carrying the pick's token on the write call (a raw-body
/// invoke carries no JSON args, so the token rides a header).
const TOKEN_HEADER: &str = "x-export-token";

/// The one pending export destination: the token proves `write_export`
/// follows the pick this run issued (a stale or forged write finds either
/// nothing or a mismatch). One export at a time — picking again replaces an
/// unconsumed destination, which simply invalidates the older token.
#[derive(Default)]
pub struct ExportState {
  pending: Mutex<Option<(u64, PathBuf)>>,
  counter: std::sync::atomic::AtomicU64,
}

/// The dialog's default file name comes from the webview: keep it a plain
/// base name (no path separators, no control characters) so a hostile page
/// cannot steer the dialog outside the user's chosen directory.
fn sanitize_file_name(name: &str) -> String {
  let cleaned: String = name
    .chars()
    .map(|c| match c {
      '/' | '\\' | ':' => '_',
      c if c.is_control() => '_',
      c => c,
    })
    .collect();
  let trimmed = cleaned.trim().trim_start_matches('.');
  if trimmed.is_empty() {
    "export".into()
  } else {
    trimmed.into()
  }
}

/// Extract a byte payload from an invoke body. The webview sends raw bytes,
/// but the bundled WKWebView IPC does not always carry them as Raw — a JSON
/// number array arrives instead. Accept both: the payload is the payload.
fn body_bytes(body: &InvokeBody) -> Result<Vec<u8>, String> {
  match body {
    InvokeBody::Raw(bytes) => Ok(bytes.clone()),
    InvokeBody::Json(value) => serde_json::from_value(value.clone())
      .map_err(|e| format!("body is neither raw bytes nor a byte array: {e}")),
  }
}

/// Open the native save dialog with the suggested name; keep the chosen path
/// in Rust and hand the webview an opaque token for the write step.
/// `Ok(None)` when the user cancelled — the webview must confirm nothing.
#[tauri::command]
pub async fn pick_export_path(
  app: tauri::AppHandle,
  state: tauri::State<'_, ExportState>,
  name: String,
) -> Result<Option<String>, String> {
  let (tx, rx) = tokio::sync::oneshot::channel();
  let mut dialog = app.dialog().file().set_file_name(sanitize_file_name(&name));
  // Parent the panel to the main window: an orphan NSSavePanel can open
  // BEHIND the app window — to the user, « nothing happens ».
  if let Some(window) = tauri::Manager::get_webview_window(&app, "main") {
    dialog = dialog.set_parent(&window);
  }
  dialog.save_file(move |path| {
    let _ = tx.send(path);
  });
  let Some(chosen) = rx.await.map_err(|_| "save dialog closed unexpectedly")? else {
    return Ok(None);
  };
  let path = chosen
    .into_path()
    .map_err(|e| format!("unusable save path: {e}"))?;
  let token = state
    .counter
    .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
  *state.pending.lock().await = Some((token, path));
  Ok(Some(token.to_string()))
}

/// Write the payload to the destination the matching pick chose. The token
/// is consumed either way — a failed write needs a fresh pick.
#[tauri::command]
pub async fn write_export(
  state: tauri::State<'_, ExportState>,
  request: Request<'_>,
) -> Result<(), String> {
  let token: u64 = request
    .headers()
    .get(TOKEN_HEADER)
    .and_then(|value| value.to_str().ok())
    .and_then(|value| value.parse().ok())
    .ok_or("write_export expects an x-export-token header")?;
  let bytes = body_bytes(request.body())?;
  let Some((pending, path)) = state.pending.lock().await.take() else {
    return Err("no export destination pending".into());
  };
  if pending != token {
    return Err("stale export token".into());
  }
  tokio::task::spawn_blocking(move || {
    std::fs::write(&path, bytes).map_err(|e| format!("cannot write {}: {e}", path.display()))
  })
  .await
  .map_err(|e| format!("write task failed: {e}"))?
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn keeps_plain_names_and_neutralizes_separators() {
    assert_eq!(sanitize_file_name("piste_stems.zip"), "piste_stems.zip");
    assert_eq!(sanitize_file_name("a/b\\c:d.wav"), "a_b_c_d.wav");
    assert_eq!(sanitize_file_name("..\\..\\evil.exe"), "_.._evil.exe");
  }

  #[test]
  fn hidden_or_empty_names_fall_back() {
    assert_eq!(sanitize_file_name(".hidden"), "hidden");
    assert_eq!(sanitize_file_name("   "), "export");
    assert_eq!(sanitize_file_name(""), "export");
  }

  #[test]
  fn accepts_raw_and_json_byte_bodies() {
    assert_eq!(
      body_bytes(&InvokeBody::Raw(vec![1, 2, 3])).unwrap(),
      vec![1, 2, 3]
    );
    let json = InvokeBody::Json(serde_json::json!([4, 5, 6]));
    assert_eq!(body_bytes(&json).unwrap(), vec![4, 5, 6]);
    let bad = InvokeBody::Json(serde_json::json!({ "not": "bytes" }));
    assert!(body_bytes(&bad).is_err());
  }
}
