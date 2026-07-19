mod download;
mod export;
mod menu;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(download::DownloadState::default())
    .manage(export::ExportState::default())
    .invoke_handler(tauri::generate_handler![
      download::download_track,
      download::cancel_download,
      export::pick_export_path,
      export::write_export
    ])
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
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
