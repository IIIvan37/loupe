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

/** A manual octave correction: ×2 doubles the felt tempo, ÷2 halves it. */
export type OctaveFactor = 0.5 | 2

/** The detected tempo as a value: a representative bpm and its beat grid. */
export interface TempoValue {
  readonly bpm: number
  readonly grid: BeatGrid
}

/**
 * Correct an octave error by folding the beat density. Dividing by two drops
 * every other beat; multiplying by two inserts a beat at each midpoint. The bpm
 * scales by the same factor and the grid is rebuilt so downbeats re-anchor from
 * the first beat. Pure — the caller supplies the meter (default common time).
 */
export function foldTempoOctave(
  tempo: TempoValue,
  factor: OctaveFactor,
  beatsPerBar: number = DEFAULT_BEATS_PER_BAR
): TempoValue {
  const times = tempo.grid.map((beat) => beat.timeSeconds)
  const folded = factor === 0.5 ? halveBeats(times) : doubleBeats(times)
  return { bpm: tempo.bpm * factor, grid: buildBeatGrid(folded, beatsPerBar) }
}

/** Keep every other beat, halving the density. */
function halveBeats(times: readonly number[]): readonly number[] {
  return times.filter((_, index) => index % 2 === 0)
}

/** Insert a beat at each midpoint, doubling the density. */
function doubleBeats(times: readonly number[]): readonly number[] {
  const doubled: number[] = []
  times.forEach((time, index) => {
    doubled.push(time)
    const next = times[index + 1]
    if (next !== undefined) {
      doubled.push((time + next) / 2)
    }
  })
  return doubled
}
