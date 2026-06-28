import { buildTrack, type Track } from './track.ts'

/**
 * One separated source, summarised for display: a named, render-ready `Track`.
 * Holds no raw PCM — like `Track`, the heavy sample buffers stay in the adapter.
 */
export interface StemTrack {
  readonly id: string
  readonly label: string
  readonly track: Track
}

/** The full set of stems a separation produced, in display order. */
export type StemSet = readonly StemTrack[]

/**
 * Summarise one stem's raw channels into a named `StemTrack`, reusing the same
 * mono-mix → waveform reduction as a full track. Pure — values in, value out.
 */
export function buildStemTrack(
  id: string,
  label: string,
  channels: ReadonlyArray<ArrayLike<number>>,
  sampleRate: number,
  bucketCount: number
): StemTrack {
  return { id, label, track: buildTrack(channels, sampleRate, bucketCount) }
}
