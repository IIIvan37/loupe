import type { DownloadProgress, FetchedTrack, TrackSource } from '@app/core'
import { isServerShell } from '../lib/server-shell.ts'
import { createHttpTrackSource } from './http/http-track-source.ts'

/**
 * Build the `TrackSource` adapter. Downloading a track from a media URL
 * (YouTube / SoundCloud) needs **yt-dlp**, which the browser cannot run:
 * in the server shell (distribution D1) the local loupe server drives it
 * (`crates/loupe-server/src/download.rs`) and streams NDJSON progress from its
 * own origin.
 * In the plain browser URL import is impossible — the UI never exposes it,
 * and this guard makes the impossibility explicit if something ever calls it.
 */
export function createTrackSource(): TrackSource {
  if (isServerShell()) {
    return createHttpTrackSource(window.location.origin)
  }
  return {
    fetch(
      _url: string,
      _onProgress: (progress: DownloadProgress) => void,
      _signal?: AbortSignal
    ): Promise<FetchedTrack> {
      return Promise.reject(
        new Error(
          'URL import needs the local loupe server — the browser cannot run yt-dlp.'
        )
      )
    }
  }
}
