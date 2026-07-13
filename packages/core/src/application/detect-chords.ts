import {
  deduceStructure,
  renderStructuredSource
} from '../domain/chart-structure.ts'
import { chordLabelPerMeasure } from '../domain/chord-detection.ts'
import type { BeatGrid } from '../domain/tempo.ts'
import { errorMessage } from './error-message.ts'
import type { ChordDetector, DecodedAudio } from './ports.ts'

export interface DetectChordsInput {
  /** The already-decoded track — the SAME PCM the player loaded, not a re-import. */
  readonly audio: DecodedAudio
  /** The beat grid anchoring measures — detected or manual, downbeats flagged. */
  readonly grid: BeatGrid
  /** The lead-sheet's row width, so the draft wraps like the user's layout. */
  readonly barsPerRow: number
  /** Cooperative cancellation, forwarded to the detector port. */
  readonly signal?: AbortSignal
}

export interface DetectChordsDeps {
  readonly detector: ChordDetector
}

/**
 * Why a detection failed, discriminated so the UI can speak each case in the
 * user's language (Lot G standard) instead of echoing raw engine text.
 */
export type ChordDetectionErrorCode =
  | 'no-downbeat'
  | 'no-chords'
  | 'engine-unavailable'
  | 'network'
  | 'timeout'
  | 'too-large'
  | 'unknown'

/**
 * The typed failure a `ChordDetector` adapter throws when it can tell WHY the
 * engine call failed (server up but engine missing, network unreachable,
 * analysis timed out, upload over the server's cap). The use-case forwards
 * the code; anything else it catches folds into `unknown`.
 */
export class ChordDetectionError extends Error {
  constructor(
    readonly code: 'engine-unavailable' | 'network' | 'timeout' | 'too-large',
    detail: string
  ) {
    super(detail)
    this.name = 'ChordDetectionError'
  }
}

export type DetectChordsResult =
  | { readonly ok: true; readonly source: string }
  | {
      readonly ok: false
      readonly code: ChordDetectionErrorCode
      /** The raw engine/transport message — for the console, never the UI. */
      readonly detail: string
    }

/**
 * Orchestration use-case, pure: hand the loaded PCM to the chord detector port,
 * fold its timestamped spans into ONE chord per measure on the beat grid
 * (`chordLabelPerMeasure`), deduce the song's structure from the repetition in
 * that sequence (`deduceStructure`) and render it as grid SOURCE text — the
 * draft the chord-chart editor pre-fills and the user corrects; imperfect
 * estimation is
 * absorbed by editing, never exposed raw. A grid without downbeats cannot
 * anchor measures, so it is rejected BEFORE the engine runs (application
 * policy, like `importFromUrl`'s URL guard); a detection yielding no measures
 * is an error too — an empty draft would silently wipe the user's chart.
 */
export async function detectChords(
  input: DetectChordsInput,
  deps: DetectChordsDeps
): Promise<DetectChordsResult> {
  if (!input.grid.some((beat) => beat.downbeat)) {
    return {
      ok: false,
      code: 'no-downbeat',
      detail: 'no downbeat to anchor measures on'
    }
  }
  try {
    const spans = await deps.detector.detect(input.audio, input.signal)
    // Garbage times (an adapter parsing a malformed number) must surface as an
    // error, not fold into a confidently-blank draft.
    const finite = spans.every(
      (span) =>
        Number.isFinite(span.startSeconds) && Number.isFinite(span.endSeconds)
    )
    if (!finite) {
      return { ok: false, code: 'unknown', detail: 'invalid chord detection' }
    }
    const labels = chordLabelPerMeasure(spans, input.grid)
    if (labels.length === 0) {
      return { ok: false, code: 'no-chords', detail: 'no chords detected' }
    }
    return {
      ok: true,
      source: renderStructuredSource(deduceStructure(labels), input.barsPerRow)
    }
  } catch (e) {
    const code = e instanceof ChordDetectionError ? e.code : 'unknown'
    return { ok: false, code, detail: errorMessage(e) }
  }
}
