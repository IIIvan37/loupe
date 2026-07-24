mod close_guard;
mod download;
mod export;
mod menu;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(close_guard::CloseGuardState::default())
    .manage(download::DownloadState::default())
    .manage(export::ExportState::default())
    .invoke_handler(tauri::generate_handler![
      close_guard::arm_close_guard,
      close_guard::confirm_close,
      download::download_track,
      download::cancel_download,
      export::pick_export_path,
      export::write_export
    ])
    // AP.2: the red button never kills unsaved work — the webview decides.
    .on_window_event(close_guard::on_window_event)
    // Registered first (Tauri requirement). One instance also protects the
    // filesystem project stores: a second instance's startup audio GC could
    // race a save in the first and sweep a just-written blob as an orphan.
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      use tauri::Manager;
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
      }
    }))
    .plugin(tauri_plugin_deep_link::init())
    // AP.3: window size/position/maximised survive relaunches (Rust-side
    // only, restored on init — no webview API surface needed).
    .plugin(tauri_plugin_window_state::Builder::default().build())
    // Rust-side only (the save dialog of export_file): no webview-facing
    // dialog permission is granted in the capabilities.
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .menu(menu::build)
    .on_menu_event(|app, event| menu::forward(app, event.id().as_ref()))
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    // AP.2: Cmd+Q takes the app-level exit path (no CloseRequested) — the
    // same guard holds it open until the webview confirms.
    .run(|app, event| close_guard::on_run_event(app, &event));
}
