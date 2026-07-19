import type { DownloadProgress, FetchedTrack, TrackSource } from '@app/core'
import { isTauriShell } from '../auth/tauri-env.ts'
import { createTauriDownloadBridge } from './tauri-download-bridge.ts'
import { createTauriTrackSource } from './tauri-track-source.ts'

/**
 * Build the `TrackSource` adapter. Downloading a track from a media URL
 * (YouTube / SoundCloud) needs **yt-dlp**, which the browser cannot run:
 * inside the Tauri shell the Rust side drives a managed yt-dlp binary (T2.3).
 * Offload-only (Lot AJ): there is no local server to fall back to, so URL
 * import is **desktop-only** — the browser's UI never exposes it, and this
 * guard makes the impossibility explicit if something ever calls it.
 */
export function createTrackSource(): TrackSource {
  if (isTauriShell()) {
    return createTauriTrackSource(createTauriDownloadBridge())
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
