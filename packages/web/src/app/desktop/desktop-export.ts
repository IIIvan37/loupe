import { isTauriShell } from '../../auth/tauri-env.ts'

/**
 * `window.print()` has no delegate in the desktop webview (WKWebView): it
 * silently no-ops. Until a native print path lands, the honest face is a
 * DISABLED control that says so — never a silent nothing. File exports are
 * NOT gated any more: they go through the native save dialog
 * (`deliverFile` → the Rust `export_file` command).
 */
export function printUnavailableOnDesktop(): boolean {
  return isTauriShell()
}
