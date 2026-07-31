import type { TrackSourceMetadata } from '@app/core'

/**
 * Assemble a `TrackSourceMetadata` from what a downloader reports, omitting
 * the optionals it left out (the manifest never carries `undefined`/`null`
 * keys). Shared spelling for every `TrackSource` adapter so an
 * imported track's metadata stays identical — the same YouTube URL yields the
 * same manifest whatever fetched it.
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
