//! AP.2 — the native unsaved-work guard. Closing the window (red button) or
//! quitting (Cmd+Q, Dock) never kills work silently: both paths are held
//! open and forwarded to the webview as a `close-requested` event — the
//! webview owns the dirty state, so IT decides (confirm dialog when dirty,
//! immediate `confirm_close` when clean).
//!
//! The guard only bites once the webview has ARMED it (right after it
//! subscribes): before React mounts there is no unsaved work to protect,
//! and a crashed/hung webview must never make the app unclosable — an
//! unarmed guard lets every exit through. Known limit: a webview reload
//! would leave the guard armed with no listener; the app never navigates,
//! so that path only exists in dev.

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager, RunEvent, Runtime, Window, WindowEvent};

/// Event the webview listens for; carries no payload.
pub const CLOSE_REQUESTED: &str = "close-requested";

#[derive(Default)]
pub struct CloseGuardState {
  /// The webview is subscribed and owns the decision.
  armed: AtomicBool,
  /// One-way latch: the webview confirmed — let every later exit through.
  exit_allowed: AtomicBool,
}

impl CloseGuardState {
  fn holds(&self) -> bool {
    self.armed.load(Ordering::SeqCst) && !self.exit_allowed.load(Ordering::SeqCst)
  }
}

/// Red-button path: hold the window open, let the webview decide.
pub fn on_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
  if let WindowEvent::CloseRequested { api, .. } = event {
    let state = window.state::<CloseGuardState>();
    if !state.holds() {
      return;
    }
    api.prevent_close();
    let _ = window.emit(CLOSE_REQUESTED, ());
  }
}

/// Cmd+Q / Dock-quit path: app-level exit never sees `CloseRequested`, so the
/// same guard must sit on `ExitRequested` or the menu bypasses the dialog.
pub fn on_run_event<R: Runtime>(app: &AppHandle<R>, event: &RunEvent) {
  if let RunEvent::ExitRequested { api, .. } = event {
    let state = app.state::<CloseGuardState>();
    if !state.holds() {
      return;
    }
    if let Some(window) = app.get_webview_window("main") {
      api.prevent_exit();
      let _ = window.emit(CLOSE_REQUESTED, ());
    }
  }
}

/// The webview is subscribed: from here on, exits wait for its verdict.
#[tauri::command]
pub fn arm_close_guard(state: tauri::State<'_, CloseGuardState>) {
  state.armed.store(true, Ordering::SeqCst);
}

/// The webview's verdict: work is safe (or knowingly discarded) — open the
/// latch and actually close. Destroying the last window ends the app; the
/// latch lets the ensuing `ExitRequested` through.
#[tauri::command]
pub fn confirm_close(
  window: tauri::WebviewWindow,
  state: tauri::State<'_, CloseGuardState>,
) {
  state.exit_allowed.store(true, Ordering::SeqCst);
  let _ = window.destroy();
}
