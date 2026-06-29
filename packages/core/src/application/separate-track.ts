import { buildStemTrack, type StemSet } from '../domain/stem-set.ts'
import type {
  DecodedAudio,
  SeparatedStem,
  SeparationProgress,
  StemSeparator
} from './ports.ts'

export interface SeparateTrackInput {
  /** The already-decoded track — the SAME PCM the player loaded, not a re-import. */
  readonly audio: DecodedAudio
  /** How many waveform buckets per stem — driven by the render width. */
  readonly bucketCount: number
}

export interface SeparateTrackDeps {
  readonly separator: StemSeparator
  /** Optional progress sink — the UI feeds it into the separation state machine. */
  readonly onProgress?: (progress: SeparationProgress) => void
}

export type SeparateTrackResult =
  | {
      readonly ok: true
      readonly stems: StemSet
      /** The isolated stems' raw PCM, retained so an adapter can play or export them. */
      readonly sources: readonly SeparatedStem[]
    }
  | { readonly ok: false; readonly error: string }

/**
 * Orchestration use-case, pure: hand the loaded PCM to the separator port and
 * summarise each isolated stem into a render-ready `StemTrack` — the same
 * mono-mix → waveform reduction the player uses. Progress flows straight through
 * to the optional sink. Expected failures are a `Result`, not an exception.
 */
export async function separateTrack(
  input: SeparateTrackInput,
  deps: SeparateTrackDeps
): Promise<SeparateTrackResult> {
  try {
    const separated = await deps.separator.separate(
      input.audio,
      deps.onProgress ?? (() => {})
    )
    const stems: StemSet = separated.map((stem) =>
      buildStemTrack(
        stem.id,
        stem.label,
        stem.audio.channels,
        stem.audio.sampleRate,
        input.bucketCount
      )
    )
    return { ok: true, stems, sources: separated }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
