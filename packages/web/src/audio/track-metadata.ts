import type { TrackSourceMetadata } from '@app/core'

/**
 * Assemble a `TrackSourceMetadata` from what a downloader reports, omitting
 * the optionals it left out (the manifest never carries `undefined`/`null`
 * keys). Shared by the HTTP and Tauri `TrackSource` adapters so both spell an
 * imported track's metadata identically — the same YouTube URL yields the
 * same manifest on desktop and in the browser.
 */
export function toTrackMetadata(
  title: string,
  durationSeconds: number | null | undefined,
  artist: string | null | undefined
): TrackSourceMetadata {
  return {
    title,
    ...(durationSeconds != null ? { durationSeconds } : {}),
    ...(artist != null ? { artist } : {})
  }
}
