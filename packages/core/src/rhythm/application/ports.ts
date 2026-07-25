import type { DecodedAudio } from '../../shared/decoded-audio.ts'
import type { DetectedBeat } from '../domain/beat-grid.ts'

/**
 * A detector's raw verdict: the track's representative tempo plus the beats it
 * found, each carrying its position within the bar (1 = downbeat). The core
 * derives everything else — the grid, the meter — purely from the positions, so
 * the DSP stays in the adapter and downbeats no longer have to be guessed.
 */
export interface DetectedTempo {
  /** Estimated tempo in beats per minute (representative — a read-out shortcut). */
  readonly bpm: number
  /** The detected beats in order, each with its bar position. */
  readonly beats: readonly DetectedBeat[]
}

/**
 * Driven port: estimate a track's tempo and beat positions from decoded PCM.
 * Implemented by an adapter (web: an HTTP call to the local server running a
 * beat tracker); the pure core never runs the DSP, and the audio is the SAME
 * PCM the player loaded. A cloud API or an in-browser worker could be later
 * adapters on the same port.
 */
export interface TempoDetector {
  detect(
    audio: DecodedAudio,
    /** Cooperative cancellation — an aborted run should reject promptly. */
    signal?: AbortSignal
  ): Promise<DetectedTempo>
}
