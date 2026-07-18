import type { DownloadProgress, FetchedTrack, TrackSource } from '@app/core'
import { toArrayBuffer } from '../lib/to-array-buffer.ts'
import { toTrackMetadata } from './track-metadata.ts'

/** One progress message the Rust `download_track` command streams. */
export interface TauriDownloadProgress {
  readonly type: 'progress'
  readonly phase: DownloadProgress['phase']
  readonly fraction: number
}

/** The Rust command's terminal payload. */
export interface TauriDownloadedTrack {
  /** Audio file path relative to the app-data dir (read via the fs plugin). */
  readonly relativePath: string
  readonly title: string
  readonly durationSeconds?: number | null
  readonly uploader?: string | null
}

/**
 * What the adapter needs from the Tauri runtime — invoke + the fs plugin.
 * The real binding lives in `tauri-download-bridge.ts` (humble, dynamic
 * imports); tests inject a fake.
 */
export interface TauriDownloadBridge {
  downloadTrack(
    url: string,
    onEvent: (event: TauriDownloadProgress) => void
  ): Promise<TauriDownloadedTrack>
  cancelDownload(): Promise<void>
  readFile(relativePath: string): Promise<Uint8Array>
  /** Best-effort recursive removal of a per-download temp dir. */
  removeDir(relativeDir: string): Promise<void>
}

/**
 * Desktop twin of `createHttpTrackSource` (T2.3): the download runs in the
 * shell's Rust side, which drives a managed yt-dlp binary with the same
 * guards as `server/app/download.py`. Progress streams over a Tauri channel;
 * the finished file lands in a per-download temp dir under app-data, is read
 * back through the fs plugin and removed once the bytes are in memory. The
 * pure core never knows the download ran in-process.
 */
export function createTauriTrackSource(
  bridge: TauriDownloadBridge
): TrackSource {
  return {
    async fetch(
      url: string,
      onProgress: (progress: DownloadProgress) => void,
      signal?: AbortSignal
    ): Promise<FetchedTrack> {
      if (signal?.aborted) {
        throw new Error('download aborted')
      }
      // Aborting kills the child process; the command then rejects, which the
      // caller's run-token treats as a stale rejection (never an error).
      const onAbort = () => void bridge.cancelDownload().catch(() => {})
      signal?.addEventListener('abort', onAbort, { once: true })
      try {
        const done = await bridge.downloadTrack(url, (event) =>
          onProgress({ phase: event.phase, fraction: event.fraction })
        )
        const bytes = await bridge.readFile(done.relativePath)
        const parentDir = done.relativePath.slice(
          0,
          done.relativePath.lastIndexOf('/')
        )
        await bridge.removeDir(parentDir).catch(() => {})
        return {
          bytes: toArrayBuffer(bytes),
          metadata: toTrackMetadata(
            done.title,
            done.durationSeconds,
            done.uploader
          )
        }
      } finally {
        signal?.removeEventListener('abort', onAbort)
      }
    }
  }
}
