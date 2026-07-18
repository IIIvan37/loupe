import type { DownloadProgress, FetchedTrack, TrackSource } from '@app/core'
import { streamNdjson } from './read-ndjson.ts'
import { toTrackMetadata } from './track-metadata.ts'

/** One NDJSON line the server streams while downloading a track. */
type DownloadEvent =
  | {
      readonly type: 'progress'
      readonly phase: DownloadProgress['phase']
      readonly fraction: number
    }
  | {
      readonly type: 'done'
      /** Content-addressed ref of the parked audio bytes (`GET /audio/{ref}`). */
      readonly ref: string
      readonly title: string
      /** Track length in seconds, when the source reports it. */
      readonly duration?: number
      /** The uploading artist/channel, when the source reports it. */
      readonly uploader?: string
    }
  | { readonly type: 'error'; readonly message: string }

/**
 * Driven adapter for `TrackSource`: offloads the download to the local server
 * running **yt-dlp**, which the browser cannot. The URL is POSTed; the server
 * streams NDJSON progress, then a `done` event carrying the content-addressed
 * `ref` of the audio bytes it parked in the shared `/audio` store plus the
 * track's metadata. We `GET /audio/{ref}` for the encoded bytes (fed straight
 * into `loadTrack`) and map the metadata onto `FetchedTrack`. The pure core
 * never knows the download happened off-device.
 */
export function createHttpTrackSource(baseUrl: string): TrackSource {
  return {
    async fetch(
      url: string,
      onProgress: (progress: DownloadProgress) => void,
      signal?: AbortSignal
    ): Promise<FetchedTrack> {
      // The signal covers the whole run: aborting also tears down the NDJSON
      // stream (its reader rejects) and the audio fetch below.
      const response = await fetch(`${baseUrl}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: signal ?? null
      })
      if (!response.ok || !response.body) {
        throw new Error(`download request failed: HTTP ${response.status}`)
      }

      const done = await streamNdjson<DownloadEvent>(response.body, (event) =>
        onProgress({ phase: event.phase, fraction: event.fraction })
      )

      const audioResponse = await fetch(
        new URL(`/audio/${done.ref}`, baseUrl).toString(),
        { signal: signal ?? null }
      )
      if (!audioResponse.ok) {
        throw new Error(`audio fetch failed: HTTP ${audioResponse.status}`)
      }

      return {
        bytes: await audioResponse.arrayBuffer(),
        metadata: toTrackMetadata(done.title, done.duration, done.uploader)
      }
    }
  }
}
