import {
  type BeatGrid,
  buildBeatGrid,
  DEFAULT_BEATS_PER_BAR
} from '../domain/tempo.ts'
import { errorMessage } from './error-message.ts'
import type { DecodedAudio, TempoDetector } from './ports.ts'

export interface DetectTempoInput {
  /** The already-decoded track — the SAME PCM the player loaded, not a re-import. */
  readonly audio: DecodedAudio
  /** Beats per bar for the grid's downbeats; defaults to common time (4). */
  readonly beatsPerBar?: number
}

export interface DetectTempoDeps {
  readonly detector: TempoDetector
}

/** The render-ready tempo verdict: the BPM plus a downbeat-flagged beat grid. */
export interface TempoAnalysis {
  readonly bpm: number
  readonly grid: BeatGrid
}

export type DetectTempoResult =
  | { readonly ok: true; readonly analysis: TempoAnalysis }
  | { readonly ok: false; readonly error: string }

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
    const detected = await deps.detector.detect(input.audio)
    const grid = buildBeatGrid(
      detected.beatsSeconds,
      input.beatsPerBar ?? DEFAULT_BEATS_PER_BAR
    )
    return { ok: true, analysis: { bpm: detected.bpm, grid } }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}
