/**
 * True when the app runs inside the Tauri desktop shell — wry injects its IPC
 * bridge into every page it hosts, so its presence is the discriminant.
 */
export function isTauriShell(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
