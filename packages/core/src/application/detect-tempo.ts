import { type BeatGrid, buildBeatGrid, detectMeter } from '../domain/tempo.ts'
import { errorMessage } from './error-message.ts'
import type { DecodedAudio, TempoDetector } from './ports.ts'

export interface DetectTempoInput {
  /** The already-decoded track — the SAME PCM the player loaded, not a re-import. */
  readonly audio: DecodedAudio
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
    const grid = buildBeatGrid(detected.beats)
    const beatsPerBar = detectMeter(detected.beats)
    return { ok: true, analysis: { bpm: detected.bpm, grid, beatsPerBar } }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}
