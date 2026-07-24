import {
  type BeatGrid,
  buildBeatGrid,
  detectMeter
} from '../domain/beat-grid.ts'
import { sanitizeBeatGrid } from '../domain/tempo-map.ts'
import { errorMessage } from './error-message.ts'
import type { DecodedAudio, TempoDetector } from './ports.ts'

export interface DetectTempoInput {
  /** The already-decoded track — the SAME PCM the player loaded, not a re-import. */
  readonly audio: DecodedAudio
  /** Cooperative cancellation, forwarded to the detector port. */
  readonly signal?: AbortSignal
}

export interface DetectTempoDeps {
  readonly detector: TempoDetector
}

/**
 * The render-ready tempo verdict: the BPM, a downbeat-flagged beat grid, and the
 * meter (beats per bar) derived from the detector's bar positions.
 */
export interface TempoAnalysis {
  readonly bpm: number
  readonly grid: BeatGrid
  readonly beatsPerBar: number
}

/**
 * Why a detection failed, discriminated so the UI can speak each case in the
 * user's language (Lot G standard) instead of echoing raw engine text — the
 * same contract `detectChords` established (N.1).
 */
export type TempoDetectionErrorCode =
  | 'engine-unavailable'
  | 'network'
  | 'timeout'
  | 'too-large'
  | 'unknown'

/**
 * The typed failure a `TempoDetector` adapter throws when it can tell WHY the
 * engine call failed (server up but engine missing, network unreachable,
 * analysis timed out, upload over the server's cap). The use-case forwards
 * the code; anything else it catches folds into `unknown`.
 */
export class TempoDetectionError extends Error {
  readonly code: Exclude<TempoDetectionErrorCode, 'unknown'>

  constructor(
    code: Exclude<TempoDetectionErrorCode, 'unknown'>,
    detail: string
  ) {
    super(detail)
    this.code = code
    this.name = 'TempoDetectionError'
  }
}

export type DetectTempoResult =
  | { readonly ok: true; readonly analysis: TempoAnalysis }
  | {
      readonly ok: false
      readonly code: TempoDetectionErrorCode
      /** The raw engine/transport message — for the console, never the UI. */
      readonly detail: string
    }

/**
 * Orchestration use-case, pure: hand the loaded PCM to the tempo detector port
 * and fold its beat instants into a downbeat-flagged grid the UI can draw. The
 * audio is the SAME PCM the player loaded. Expected failures (the detector
 * unreachable) are a `Result`, not an exception.
 */
export async function detectTempo(
  input: DetectTempoInput,
  deps: DetectTempoDeps
): Promise<DetectTempoResult> {
  try {
    const detected = await deps.detector.detect(input.audio, input.signal)
    // Sanitize HERE so every adapter's payload gets the same guard — the
    // server filters double-fires too, but not map-aware transition noise.
    const grid = sanitizeBeatGrid(buildBeatGrid(detected.beats))
    const beatsPerBar = detectMeter(detected.beats)
    return { ok: true, analysis: { bpm: detected.bpm, grid, beatsPerBar } }
  } catch (e) {
    const code = e instanceof TempoDetectionError ? e.code : 'unknown'
    return { ok: false, code, detail: errorMessage(e) }
  }
}
