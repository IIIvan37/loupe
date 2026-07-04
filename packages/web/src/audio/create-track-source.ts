import type { TrackSource } from '@app/core'
import { SERVER_URL } from '../projects/server-url.ts'
import { createHttpTrackSource } from './http-track-source.ts'

/**
 * Build the `TrackSource` adapter. Downloading a track from a media URL
 * (YouTube / SoundCloud) runs on the local server via **yt-dlp** reached over
 * HTTP — point it at the server with `VITE_SEPARATOR_URL` (defaults to
 * `http://localhost:8000`). The browser cannot run yt-dlp itself.
 */
export function createTrackSource(): TrackSource {
  return createHttpTrackSource(SERVER_URL)
}
