import { buildTrack, type Track } from '../domain/track.ts'
import type { DecodedAudio } from '../shared/decoded-audio.ts'
import { errorMessage } from '../shared/error-message.ts'
import type { AudioFileDecoder, PlaybackEngine } from './ports.ts'

export interface LoadTrackInput {
  readonly bytes: ArrayBuffer
  /** How many waveform buckets to produce — driven by the render width. */
  readonly bucketCount: number
}

export interface LoadTrackDeps {
  readonly decoder: AudioFileDecoder
  readonly engine: PlaybackEngine
}

export type LoadTrackResult =
  | { readonly ok: true; readonly track: Track; readonly audio: DecodedAudio }
  | { readonly ok: false; readonly error: string }

/**
 * Orchestration use-case, pure: decode the bytes once via the decoder port,
 * summarise them in the domain into a `Track`, and hand the same PCM to the
 * playback engine port — so a file is decoded a single time for both the
 * waveform and playback. The decoded PCM is also returned so a consumer (stem
 * separation) can reuse the SAME audio without a second decode. No Web Audio
 * here; it arrives through `deps`. Expected
 * failures (bad bytes, decoder error) are a `Result`, not an exception.
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
    await deps.engine.load(decoded)
    return { ok: true, track, audio: decoded }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}
