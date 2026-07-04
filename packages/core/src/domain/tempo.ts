/** The default bar length when no meter is known: common time (4/4). */
export const DEFAULT_BEATS_PER_BAR = 4

/** One beat on the timeline: its instant and whether it starts a bar. */
export interface Beat {
  readonly timeSeconds: number
  /** True on the first beat of each bar (a downbeat), drawn stronger. */
  readonly downbeat: boolean
}

/** A detected beat grid: the beat instants in order, downbeats flagged. */
export type BeatGrid = readonly Beat[]

/**
 * Fold detected beat instants into a grid, flagging every `beatsPerBar`-th beat
 * (starting at the first) as a downbeat. Pure — meter is assumed constant since
 * the detector reports beats, not bar lines; grouping from the first beat is the
 * simplest alignment and matches how the first downbeat anchors a practice loop.
 */
export function buildBeatGrid(
  beatsSeconds: readonly number[],
  beatsPerBar: number
): BeatGrid {
  return beatsSeconds.map((timeSeconds, index) => ({
    timeSeconds,
    downbeat: index % beatsPerBar === 0
  }))
}
