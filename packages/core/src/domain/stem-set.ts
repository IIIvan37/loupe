import type { DetectedStem } from './instrument-detection.ts'
import { buildTrack, type Track } from './track.ts'

/**
 * One separated source, summarised for display: a named, render-ready `Track`
 * plus the adaptive-detection verdict (is it really present, and how sure).
 * Holds no raw PCM — like `Track`, the heavy sample buffers stay in the adapter.
 */
export interface StemTrack {
  readonly id: string
  readonly label: string
  readonly track: Track
  /** Heuristic confidence the instrument is present, in [0, 1]. */
  readonly confidence: number
  /** Whether detection kept this stem (false = masked as near-silence). */
  readonly present: boolean
}

/** The full set of stems a separation produced, in display order. */
export type StemSet = readonly StemTrack[]

/**
 * Summarise one stem's raw channels into a named `StemTrack`, reusing the same
 * mono-mix → waveform reduction as a full track and attaching its detection
 * verdict. Pure — values in, value out.
 */
export function buildStemTrack(
  id: string,
  label: string,
  channels: ReadonlyArray<ArrayLike<number>>,
  sampleRate: number,
  bucketCount: number,
  detection: Pick<DetectedStem, 'confidence' | 'present'>
): StemTrack {
  return {
    id,
    label,
    track: buildTrack(channels, sampleRate, bucketCount),
    confidence: detection.confidence,
    present: detection.present
  }
}
