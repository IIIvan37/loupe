/** The default bar length when no meter is known: common time (4/4). */
export const DEFAULT_BEATS_PER_BAR = 4

/** The longest bar a meter correction accepts — past 12/4, it's noise. */
export const MAX_BEATS_PER_BAR = 12

/**
 * One detected beat: its instant and its position within the bar. Position 1 is
 * a downbeat (the first beat of a bar); the detector reports it directly, so the
 * grid no longer has to guess the meter by counting from the first beat.
 */
export interface DetectedBeat {
  readonly timeSeconds: number
  readonly barPosition: number
}

/** One beat on the timeline: its instant and whether it starts a bar. */
export interface Beat {
  readonly timeSeconds: number
  /** True on the first beat of each bar (a downbeat), drawn stronger. */
  readonly downbeat: boolean
}

/** A detected beat grid: the beat instants in order, downbeats flagged. */
export type BeatGrid = readonly Beat[]

/**
 * Fold positioned beats into a grid, flagging the ones the detector placed at
 * bar position 1 as downbeats. Pure — the meter is carried per beat (robust to a
 * pickup bar or a missing beat), not inferred by counting from the first one.
 */
export function buildBeatGrid(beats: readonly DetectedBeat[]): BeatGrid {
  return beats.map((beat) => ({
    timeSeconds: beat.timeSeconds,
    downbeat: beat.barPosition === 1
  }))
}

/**
 * Derive the meter (beats per bar) from positioned beats: the DOMINANT length
 * of the complete bars (downbeat to downbeat) — a stray high position (a
 * detector slip on one bar) must not promote the whole song to that meter.
 * Before a full bar exists the positions are all there is, so the largest one
 * stands in; no beats at all falls back to common time.
 */
export function detectMeter(beats: readonly DetectedBeat[]): number {
  // The same downbeat→downbeat projection the chart reads (one loop to rule
  // measures), minus the trailing bar — open-ended, it runs to the last beat
  // instead of closing on a downbeat, so it never testifies.
  const bars = meterPerMeasure(buildBeatGrid(beats)).slice(0, -1)
  if (bars.length > 0) return dominantMeter(bars)
  const max = beats.reduce((seen, beat) => Math.max(seen, beat.barPosition), 0)
  return max > 0 ? max : DEFAULT_BEATS_PER_BAR
}

/**
 * The beats each measure holds — the i-th measure is the grid's i-th
 * downbeat→downbeat interval (the same projection `measureIndexAt` and the
 * chord draft use), the last one running to the end of the grid. Pickup beats
 * before the first downbeat belong to no measure; a grid without downbeats has
 * no measure at all.
 */
export function meterPerMeasure(grid: BeatGrid): readonly number[] {
  const meters: number[] = []
  let count: number | undefined
  for (const beat of grid) {
    if (beat.downbeat) {
      if (count !== undefined) meters.push(count)
      count = 0
    }
    if (count !== undefined) count += 1
  }
  if (count !== undefined) meters.push(count)
  return meters
}

/**
 * The meter a song is felt in: the most frequent per-measure length, the
 * first-seen one on a tie. Common time when there is no measure to read.
 */
export function dominantMeter(meters: readonly number[]): number {
  const counts = new Map<number, number>()
  for (const meter of meters) {
    counts.set(meter, (counts.get(meter) ?? 0) + 1)
  }
  let winner: number | undefined
  let best = 0
  for (const [meter, count] of counts) {
    if (count > best) {
      winner = meter
      best = count
    }
  }
  return winner ?? DEFAULT_BEATS_PER_BAR
}

/**
 * Clamp a user-typed bar length to whole bars of at least one beat — the one
 * rule `remeterGrid` and `buildManualGrid` must always agree on.
 */
export function clampBeatsPerBar(beatsPerBar: number): number {
  return Math.max(1, Math.floor(beatsPerBar) || 1)
}

/**
 * Re-flag the grid's downbeats every `beatsPerBar` beats — the user's meter
 * correction when the detector heard the wrong bar length (a 4/4 song read as
 * 6 beats). Beat instants survive verbatim; the new bars anchor on the first
 * existing downbeat so the detected bar phase (and any pickup before it) is
 * kept, or on the first beat when the grid never had one. The bar length
 * clamps to whole bars of at least one beat, like `buildManualGrid`.
 */
export function remeterGrid(grid: BeatGrid, beatsPerBar: number): BeatGrid {
  const bar = clampBeatsPerBar(beatsPerBar)
  const anchor = Math.max(
    0,
    grid.findIndex((beat) => beat.downbeat)
  )
  return grid.map((beat, index) => ({
    timeSeconds: beat.timeSeconds,
    // Beats before the anchor stay a pickup — no retroactive downbeat.
    downbeat: index >= anchor && (index - anchor) % bar === 0
  }))
}

/**
 * The measure being played at an instant: the lead-sheet's i-th measure maps
 * onto the grid's i-th downbeat→downbeat interval, so the index is the count of
 * downbeats at or before the instant, minus one. Undefined before the first
 * downbeat (a pickup has no bar yet) or without a grid — the projection simply
 * has nothing to highlight. Derived, never stored (see the tempo map).
 */
export function measureIndexAt(
  grid: BeatGrid,
  seconds: number
): number | undefined {
  // A plain count, no intermediate array — this runs per animation frame
  // during playback (the shell projects the playhead through it).
  let started = 0
  for (const beat of grid) {
    if (beat.downbeat && beat.timeSeconds <= seconds) {
      started += 1
    }
  }
  return started === 0 ? undefined : started - 1
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
 * scales by the same factor. Downbeat flags are carried from the retained beats
 * (inserted midpoints are never downbeats), so the felt bar phase stays anchored
 * to the same instants instead of being re-counted from the first beat.
 */
export function foldTempoOctave(
  tempo: TempoValue,
  factor: OctaveFactor
): TempoValue {
  const grid = factor === 0.5 ? halveGrid(tempo.grid) : doubleGrid(tempo.grid)
  return { bpm: tempo.bpm * factor, grid }
}

/** Keep every other beat, halving the density and preserving its downbeat flag. */
function halveGrid(grid: BeatGrid): BeatGrid {
  return grid.filter((_, index) => index % 2 === 0)
}

/** Insert a non-downbeat at each midpoint, doubling the density. */
function doubleGrid(grid: BeatGrid): BeatGrid {
  const doubled: Beat[] = []
  grid.forEach((beat, index) => {
    doubled.push(beat)
    const next = grid[index + 1]
    if (next !== undefined) {
      doubled.push({
        timeSeconds: (beat.timeSeconds + next.timeSeconds) / 2,
        downbeat: false
      })
    }
  })
  return doubled
}
