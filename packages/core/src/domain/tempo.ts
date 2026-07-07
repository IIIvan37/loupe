/** The default bar length when no meter is known: common time (4/4). */
export const DEFAULT_BEATS_PER_BAR = 4

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
 * Derive the meter (beats per bar) from positioned beats: the largest bar
 * position seen. Falls back to common time when the detector reported no beats.
 */
export function detectMeter(beats: readonly DetectedBeat[]): number {
  const max = beats.reduce((seen, beat) => Math.max(seen, beat.barPosition), 0)
  return max > 0 ? max : DEFAULT_BEATS_PER_BAR
}

/** One stretch of steady tempo: from this instant on, the track runs at `bpm`. */
export interface TempoSegment {
  readonly fromSeconds: number
  readonly bpm: number
}

/**
 * The track's tempo over time, as steady stretches in order. A constant-tempo
 * track is a single segment; a tempo change starts a new one.
 */
export type TempoMap = readonly TempoSegment[]

/**
 * Derive the tempo map from the beat grid's instants. Pure — the grid is the
 * single source of truth (persisted with the project), the map is re-derived
 * wherever it's needed.
 */
/**
 * How far a beat interval may stray from its segment's median before it reads
 * as a tempo change rather than jitter (relative, ±8%).
 */
const TEMPO_RUPTURE_TOLERANCE = 0.08

export function buildTempoMap(grid: BeatGrid): TempoMap {
  const [firstBeat, secondBeat, ...restBeats] = grid
  if (firstBeat === undefined || secondBeat === undefined) {
    return []
  }
  // Walk the gaps between consecutive beats, opening a new segment when a gap
  // strays beyond the tolerance of the running median AND the following gap
  // confirms it — a lone outlier (a missed beat) is jitter, not a new tempo.
  const segments: TempoSegment[] = []
  let anchor = firstBeat // the beat opening the current segment
  let previous = secondBeat // the beat opening the current gap
  let gaps = [secondBeat.timeSeconds - firstBeat.timeSeconds]
  restBeats.forEach((beat, index) => {
    const gap = beat.timeSeconds - previous.timeSeconds
    const nextBeat = restBeats[index + 1]
    const reference = median(gaps)
    const ruptures =
      deviates(gap, reference) &&
      nextBeat !== undefined &&
      deviates(nextBeat.timeSeconds - beat.timeSeconds, reference)
    if (ruptures) {
      segments.push({ fromSeconds: anchor.timeSeconds, bpm: 60 / reference })
      anchor = previous
      gaps = [gap]
    } else {
      gaps.push(gap)
    }
    previous = beat
  })
  segments.push({ fromSeconds: anchor.timeSeconds, bpm: 60 / median(gaps) })
  return segments
}

/**
 * The tempo felt at an instant: the last segment starting at or before it, or
 * the first segment before any beat (the intro is heard at the initial tempo).
 * Undefined only when the map is empty (no derivable tempo).
 */
export function tempoAt(map: TempoMap, seconds: number): number | undefined {
  let felt = map[0]
  for (const segment of map) {
    if (segment.fromSeconds <= seconds) {
      felt = segment
    }
  }
  return felt?.bpm
}

/** Whether an interval strays beyond the rupture tolerance of its reference. */
function deviates(interval: number, reference: number): boolean {
  return Math.abs(interval - reference) / reference > TEMPO_RUPTURE_TOLERANCE
}

/** The middle value of a non-empty list (mean of the two middles when even). */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  // For an odd length both picks are the same element, so the mean is a no-op.
  const upper = sorted[mid]
  const lower = sorted[sorted.length % 2 === 1 ? mid : mid - 1]
  return ((upper ?? Number.NaN) + (lower ?? Number.NaN)) / 2
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
