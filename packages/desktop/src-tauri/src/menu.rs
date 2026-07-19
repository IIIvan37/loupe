//! The native macOS menu bar, in French. Two jobs: give the standard Edit
//! roles their native selectors (without an Edit menu, Cmd+C/V/X never reach
//! the webview's text fields on macOS), and surface the app-level actions
//! (import, save, shortcuts help) where a mac user looks for them. Custom
//! items emit a `menu` event the webview routes to its existing handlers —
//! the menu stays dumb.

use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Runtime};

/// Item ids the webview listens for on the `menu` event.
pub const IMPORT: &str = "import";
pub const SAVE: &str = "save";
pub const SHORTCUTS: &str = "shortcuts";

pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
  let about = AboutMetadata {
    name: Some("Loupe".into()),
    ..Default::default()
  };
  let app_menu = Submenu::with_items(
    app,
    "Loupe",
    true,
    &[
      &PredefinedMenuItem::about(app, Some("À propos de Loupe"), Some(about))?,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::hide(app, Some("Masquer Loupe"))?,
      &PredefinedMenuItem::hide_others(app, Some("Masquer les autres"))?,
      &PredefinedMenuItem::show_all(app, Some("Tout afficher"))?,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::quit(app, Some("Quitter Loupe"))?,
    ],
  )?;
  let file = Submenu::with_items(
    app,
    "Fichier",
    true,
    &[
      &MenuItem::with_id(app, IMPORT, "Importer…", true, Some("CmdOrCtrl+O"))?,
      &PredefinedMenuItem::separator(app)?,
      &MenuItem::with_id(app, SAVE, "Enregistrer", true, Some("CmdOrCtrl+S"))?,
    ],
  )?;
  // The Edit menu is REQUIRED for Cmd+C/V/X/A to reach the webview's text
  // fields on macOS: without it only Ctrl works, which is wrong on a Mac.
  // No Undo/Redo (loupe has no undo, D.1). macOS auto-injects AutoFill /
  // Writing Tools / Emoji & Symbols / Dictation into ANY Edit menu, system-
  // wide, with no public opt-out — the price of a working Cmd clipboard.
  let edit = Submenu::with_items(
    app,
    "Édition",
    true,
    &[
      &PredefinedMenuItem::cut(app, Some("Couper"))?,
      &PredefinedMenuItem::copy(app, Some("Copier"))?,
      &PredefinedMenuItem::paste(app, Some("Coller"))?,
      &PredefinedMenuItem::select_all(app, Some("Tout sélectionner"))?,
    ],
  )?;
  let window = Submenu::with_items(
    app,
    "Fenêtre",
    true,
    &[
      &PredefinedMenuItem::minimize(app, Some("Réduire"))?,
      &PredefinedMenuItem::maximize(app, Some("Agrandir"))?,
      &PredefinedMenuItem::fullscreen(app, Some("Plein écran"))?,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::close_window(app, Some("Fermer la fenêtre"))?,
    ],
  )?;
  let help = Submenu::with_items(
    app,
    "Aide",
    true,
    &[&MenuItem::with_id(
      app,
      SHORTCUTS,
      "Raccourcis clavier",
      true,
      None::<&str>,
    )?],
  )?;
  Menu::with_items(app, &[&app_menu, &file, &edit, &window, &help])
}

/// Forward a custom item's activation to the webview. Predefined items act
/// natively and never reach this.
pub fn forward<R: Runtime>(app: &AppHandle<R>, id: &str) {
  if matches!(id, IMPORT | SAVE | SHORTCUTS) {
    let _ = app.emit("menu", id);
  }
}
