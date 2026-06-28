import { buildTrack, type Track } from '../domain/track.ts'
import type { AudioFileDecoder } from './ports.ts'

export interface LoadTrackInput {
  readonly bytes: ArrayBuffer
  /** How many waveform buckets to produce — driven by the render width. */
  readonly bucketCount: number
}

export interface LoadTrackDeps {
  readonly decoder: AudioFileDecoder
}

export type LoadTrackResult =
  | { readonly ok: true; readonly track: Track }
  | { readonly ok: false; readonly error: string }

/**
 * Orchestration use-case, pure: decode the bytes via the port, summarise them in
 * the domain into a `Track`. No Web Audio here — it arrives through `deps`.
 * Expected failures (bad bytes, decoder error) are a `Result`, not an exception.
 */
export async function loadTrack(
  input: LoadTrackInput,
  deps: LoadTrackDeps
): Promise<LoadTrackResult> {
  try {
    const decoded = await deps.decoder.decode(input.bytes)
    const track = buildTrack(
      decoded.channels,
      decoded.sampleRate,
      input.bucketCount
    )
    return { ok: true, track }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
