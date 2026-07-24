import {
  type DetectedStem,
  detectInstruments,
  stemEnergy
} from '../domain/instrument-detection.ts'
import type { SeparationErrorCode } from '../domain/separation.ts'
import { buildStemTrack, type StemSet } from '../domain/stem-set.ts'
import { errorMessage } from './error-message.ts'
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
  /** Optional cancellation, handed to the separator port verbatim. */
  readonly signal?: AbortSignal
}

/**
 * The typed failure a `StemSeparator` adapter throws when it can tell WHY the
 * run failed (network unreachable, upload over the cap, server timeout). The
 * use-case forwards the code; anything else it catches folds into `unknown` —
 * the same contract the detections carry (N.1, extended in M1.4).
 */
export class SeparationError extends Error {
  readonly code: Exclude<SeparationErrorCode, 'unknown'>

  constructor(code: Exclude<SeparationErrorCode, 'unknown'>, detail: string) {
    super(detail)
    this.code = code
    this.name = 'SeparationError'
  }
}

export type SeparateTrackResult =
  | {
      readonly ok: true
      readonly stems: StemSet
      /** The isolated stems' raw PCM, retained so an adapter can play or export them. */
      readonly sources: readonly SeparatedStem[]
    }
  | {
      readonly ok: false
      readonly code: SeparationErrorCode
      /** The raw engine/transport message — for the console, never the UI. */
      readonly detail: string
    }

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
      deps.onProgress ?? (() => {}),
      deps.signal
    )
    // Decide which stems are actually present (the separator emits a fixed roster;
    // a track rarely uses them all) and how confident we are, from their energy.
    const detected = detectInstruments(
      separated.map((stem) => ({
        id: stem.id,
        energy: stemEnergy(stem.audio.channels)
      }))
    )
    const stems: StemSet = separated.map((stem, index) =>
      buildStemTrack(
        stem.id,
        stem.label,
        stem.audio.channels,
        stem.audio.sampleRate,
        input.bucketCount,
        // Detection ran over `separated` in order, so the index is in bounds; the
        // assertion only satisfies `noUncheckedIndexedAccess`.
        detected[index] as DetectedStem
      )
    )
    return { ok: true, stems, sources: separated }
  } catch (e) {
    const code = e instanceof SeparationError ? e.code : 'unknown'
    return { ok: false, code, detail: errorMessage(e) }
  }
}
