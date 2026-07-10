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
  const started = grid.filter(
    (beat) => beat.downbeat && beat.timeSeconds <= seconds
  ).length
  return started === 0 ? undefined : started - 1
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

/** The slowest tempo a manual override may set (clamped, not rejected). */
export const MIN_MANUAL_BPM = 20
/** The fastest tempo a manual override may set (clamped, not rejected). */
export const MAX_MANUAL_BPM = 400

/**
 * A user-set tempo override: the tempo and the instant a downbeat falls on.
 * The whole beat grid re-derives from these two numbers (plus the meter and the
 * track length) — they ARE the user's edit, so they are what a save signs.
 */
export interface ManualTempo {
  readonly bpm: number
  /** The instant of a bar-one beat; the grid extends both ways from it. */
  readonly phaseSeconds: number
}

/**
 * Validate a typed/tapped tempo: non-finite or non-positive input is no tempo
 * at all (`Number('')` is 0 — an emptied field must not become a tempo), the
 * rest clamps into the playable manual range.
 */
export function normalizeManualBpm(bpm: number): number | undefined {
  if (!Number.isFinite(bpm) || bpm <= 0) {
    return undefined
  }
  return Math.min(MAX_MANUAL_BPM, Math.max(MIN_MANUAL_BPM, bpm))
}

/**
 * Rebuild the whole beat grid from a manual tempo: beats every 60/bpm across
 * `[0, durationSeconds]`, phase-anchored so a beat falls exactly on
 * `phaseSeconds`, downbeats every `beatsPerBar` counted through the anchor
 * (which is always bar one). Beat instants are computed as `phase + k·60/bpm`
 * from the anchor — a product, not a running sum — so the grid carries no
 * accumulated float drift.
 */
export function buildManualGrid(
  manual: ManualTempo,
  beatsPerBar: number,
  durationSeconds: number
): BeatGrid {
  const bpm = normalizeManualBpm(manual.bpm)
  if (bpm === undefined || !Number.isFinite(durationSeconds)) {
    return []
  }
  const bar = Math.max(1, Math.floor(beatsPerBar) || 1)
  const beatAt = (k: number): number => manual.phaseSeconds + (k * 60) / bpm
  // First beat index at or after the track start. The ceil is only a fast
  // guess — float rounding (down to denormal underflow) can land it one step
  // off either way, so correct it against the actual beat instants.
  let k = Math.ceil((-manual.phaseSeconds * bpm) / 60)
  while (beatAt(k - 1) >= 0) {
    k -= 1
  }
  while (beatAt(k) < 0) {
    k += 1
  }
  const beats: Beat[] = []
  for (
    let time = beatAt(k);
    time <= durationSeconds;
    k += 1, time = beatAt(k)
  ) {
    beats.push({ timeSeconds: time, downbeat: ((k % bar) + bar) % bar === 0 })
  }
  return beats
}

/** Taps further apart than this start a new sequence, not a slow tempo. */
const TAP_RESET_SECONDS = 2
/** How many taps the tempo reading looks back over. */
const TAP_WINDOW = 8

/**
 * Fold a new tap into the sequence: a tap after a long silence starts over
 * (the player stopped and came back), and only the most recent window is kept
 * so the reading follows the player's current feel.
 */
export function appendTap(
  taps: readonly number[],
  nowSeconds: number
): readonly number[] {
  const last = taps[taps.length - 1]
  if (last !== undefined && nowSeconds - last > TAP_RESET_SECONDS) {
    return [nowSeconds]
  }
  return [...taps, nowSeconds].slice(-TAP_WINDOW)
}

/**
 * Read a tempo from tap instants: 60 over the MEDIAN inter-tap interval, so a
 * single rushed or dragged tap doesn't skew the reading. Needs at least two
 * taps (one interval); returns undefined before that.
 */
export function tapTempoBpm(taps: readonly number[]): number | undefined {
  if (taps.length < 2) {
    return undefined
  }
  const intervals = taps.slice(1).map((tap, index) => tap - (taps[index] ?? 0))
  return 60 / median(intervals)
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
