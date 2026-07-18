import { isTauriShell } from '../../auth/tauri-env.ts'

/**
 * AH.1 (v1): the desktop webview has no native save/print delegate yet —
 * an anchor's `download` attribute and `window.print()` silently no-op in
 * WKWebView, while the success toast still fired (« Stems exportés » with
 * no file anywhere). Until the plugin-dialog save path lands and is
 * verified in a real bundle, the honest face is a DISABLED control that
 * says so — never a confirmation of an export that did not happen.
 */
export function exportsUnavailableOnDesktop(): boolean {
  return isTauriShell()
}
