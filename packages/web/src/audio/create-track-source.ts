import type { DownloadProgress, FetchedTrack, TrackSource } from '@app/core'
import { isServerShell } from '../lib/server-shell.ts'
import { isTauriShell } from '../lib/tauri-env.ts'
import { createHttpTrackSource } from './http-track-source.ts'
import { createTauriDownloadBridge } from './tauri-download-bridge.ts'
import { createTauriTrackSource } from './tauri-track-source.ts'

/**
 * Build the `TrackSource` adapter. Downloading a track from a media URL
 * (YouTube / SoundCloud) needs **yt-dlp**, which the browser cannot run:
 * inside the Tauri shell the Rust side drives a managed yt-dlp binary (T2.3);
 * in the server shell (distribution D1) the local loupe server drives it
 * (`server/app/download.py`) and streams NDJSON progress from its own origin.
 * In the plain browser URL import is impossible — the UI never exposes it,
 * and this guard makes the impossibility explicit if something ever calls it.
 */
export function createTrackSource(): TrackSource {
  if (isTauriShell()) {
    return createTauriTrackSource(createTauriDownloadBridge())
  }
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
        new Error('URL import is desktop-only — the browser cannot run yt-dlp.')
      )
    }
  }
}
