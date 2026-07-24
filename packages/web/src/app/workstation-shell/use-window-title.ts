import { useEffect } from 'react'
import { isTauriShell } from '../../auth/tauri-env.ts'

/** The idle title — index.html's, restored when no track is loaded. */
const BASE_TITLE = 'Loupe — poste de travail de transcription'

/**
 * AP.3 — the window says what it holds: « <morceau> — Loupe », the mac
 * dirty dot ahead while work is unsaved. `document.title` covers the
 * browser tab; under the Tauri shell the native window title is mirrored
 * too (WKWebView does not sync it from the document).
 */
export function useWindowTitle(
  trackTitle: string | undefined,
  unsavedWork: boolean
): void {
  useEffect(() => {
    const name = trackTitle === undefined ? BASE_TITLE : `${trackTitle} — Loupe`
    const title = unsavedWork ? `● ${name}` : name
    document.title = title
    if (isTauriShell()) {
      void import('@tauri-apps/api/window').then(({ getCurrentWindow }) =>
        getCurrentWindow().setTitle(title)
      )
    }
  }, [trackTitle, unsavedWork])
}
