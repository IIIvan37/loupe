import { useEffect } from 'react'

/** The idle title — index.html's, restored when no track is loaded. */
const BASE_TITLE = 'Loupe — poste de travail de transcription'

/**
 * AP.3 — the window says what it holds: « <morceau> — Loupe », the mac
 * dirty dot ahead while work is unsaved, on the browser tab's title.
 */
export function useWindowTitle(
  trackTitle: string | undefined,
  unsavedWork: boolean
): void {
  useEffect(() => {
    const name = trackTitle === undefined ? BASE_TITLE : `${trackTitle} — Loupe`
    const title = unsavedWork ? `● ${name}` : name
    document.title = title
  }, [trackTitle, unsavedWork])
}
