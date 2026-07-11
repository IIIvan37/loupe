import { errorMessage } from './error-message.ts'
import type {
  DownloadProgress,
  TrackSource,
  TrackSourceMetadata
} from './ports.ts'
import { isSupportedSourceUrl } from './supported-source.ts'

export interface ImportFromUrlInput {
  /** A media URL to import from (YouTube / SoundCloud). */
  readonly url: string
}

export interface ImportFromUrlDeps {
  readonly source: TrackSource
  /** Optional progress sink — the UI feeds it into the download progress display. */
  readonly onProgress?: (progress: DownloadProgress) => void
  /** Optional cancellation, handed to the source port verbatim. */
  readonly signal?: AbortSignal
}

export type ImportFromUrlResult =
  | {
      readonly ok: true
      /** Encoded audio bytes, ready to hand to `loadTrack`. */
      readonly bytes: ArrayBuffer
      /** Source metadata (title/artist/duration), e.g. to pre-fill the project name. */
      readonly metadata: TrackSourceMetadata
    }
  | { readonly ok: false; readonly error: string }

/**
 * Orchestration use-case, pure: fetch a track from a media URL through the
 * `TrackSource` port and return its encoded bytes + metadata for `loadTrack` to
 * decode. An unsupported URL is rejected as a `Result` BEFORE the port is ever
 * called (application policy, `isSupportedSourceUrl`), so we never hand the
 * downloader something it can't handle. Progress flows straight through to the
 * optional sink. Expected failures (bad URL, download error) are a `Result`,
 * not an exception.
 */
export async function importFromUrl(
  input: ImportFromUrlInput,
  deps: ImportFromUrlDeps
): Promise<ImportFromUrlResult> {
  if (!isSupportedSourceUrl(input.url)) {
    return { ok: false, error: `unsupported source URL: ${input.url}` }
  }
  try {
    const fetched = await deps.source.fetch(
      input.url,
      deps.onProgress ?? (() => {}),
      deps.signal
    )
    return { ok: true, bytes: fetched.bytes, metadata: fetched.metadata }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}
