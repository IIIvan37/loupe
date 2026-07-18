import type { TrackSource } from '@app/core'
import { isTauriShell } from '../auth/tauri-env.ts'
import { SERVER_URL } from '../projects/server-url.ts'
import { createHttpTrackSource } from './http-track-source.ts'
import { createTauriDownloadBridge } from './tauri-download-bridge.ts'
import { createTauriTrackSource } from './tauri-track-source.ts'

/**
 * Build the `TrackSource` adapter. Downloading a track from a media URL
 * (YouTube / SoundCloud) needs **yt-dlp**, which the browser cannot run:
 * inside the Tauri shell the Rust side drives a managed yt-dlp binary
 * (T2.3); in the browser the local server does it, reached over HTTP —
 * point it at the server with `VITE_SEPARATOR_URL` (defaults to
 * `http://localhost:8000`).
 */
export function createTrackSource(): TrackSource {
  if (isTauriShell()) {
    return createTauriTrackSource(createTauriDownloadBridge())
  }
  return createHttpTrackSource(SERVER_URL)
}
