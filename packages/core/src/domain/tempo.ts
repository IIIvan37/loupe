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
  const bars: number[] = []
  let count: number | undefined
  for (const beat of beats) {
    if (beat.barPosition === 1) {
      if (count !== undefined) bars.push(count)
      count = 0
    }
    if (count !== undefined) count += 1
  }
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
 * Re-flag the grid's downbeats every `beatsPerBar` beats — the user's meter
 * correction when the detector heard the wrong bar length (a 4/4 song read as
 * 6 temps). Beat instants survive verbatim; the new bars anchor on the first
 * existing downbeat so the detected bar phase (and any pickup before it) is
 * kept, or on the first beat when the grid never had one. The bar length
 * clamps to whole bars of at least one beat, like `buildManualGrid`.
 */
export function remeterGrid(grid: BeatGrid, beatsPerBar: number): BeatGrid {
  const bar = Math.max(1, Math.floor(beatsPerBar) || 1)
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
  return consolidateSegments(segmentGaps(sanitizeBeatGrid(grid)))
}

/** Segment a (sanitized) grid into steady runs, each with its gap support. */
function segmentGaps(grid: BeatGrid): readonly SupportedSegment[] {
  const [firstBeat, secondBeat, ...restBeats] = grid
  if (firstBeat === undefined || secondBeat === undefined) {
    return []
  }
  // Walk the gaps between consecutive beats, opening a new segment when a gap
  // strays beyond the tolerance of the running median AND the following gap
  // confirms it — a lone outlier (a missed beat) is jitter, not a new tempo.
  const segments: SupportedSegment[] = []
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
      segments.push({
        fromSeconds: anchor.timeSeconds,
        bpm: 60 / reference,
        support: gaps.length
      })
      anchor = previous
      gaps = [gap]
    } else {
      gaps.push(gap)
    }
    previous = beat
  })
  segments.push({
    fromSeconds: anchor.timeSeconds,
    bpm: 60 / median(gaps),
    support: gaps.length
  })
  return segments
}

/**
 * A tempo change must hold for at least this many beat intervals before the
 * map believes it: shorter runs are transition noise (a drum fill read as
 * double-time, a detector wobble), not a tempo the musician should see.
 */
const MIN_SEGMENT_SUPPORT = 4

/** A raw segment plus how many gaps vouched for it. */
interface SupportedSegment extends TempoSegment {
  readonly support: number
}

/**
 * Keep only segments a full run of gaps vouches for; the span of a discarded
 * run stays under the previous kept segment's reign (its median is untouched
 * by the noise, so the read-out holds steady through the transition). The
 * final segment is exempt — a closing ritardando may not live long enough to
 * qualify, and with nothing after it there is nothing to absorb it into.
 */
function consolidateSegments(segments: readonly SupportedSegment[]): TempoMap {
  return segments
    .filter(
      (segment, index) =>
        segment.support >= MIN_SEGMENT_SUPPORT || index === segments.length - 1
    )
    .map(({ fromSeconds, bpm }) => ({ fromSeconds, bpm }))
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

/**
 * A gap shorter than this fraction of the LOCAL median gap is a spurious
 * extra beat (a detector double-fire), never a faster tempo.
 */
const SPURIOUS_GAP_FRACTION = 0.4

/**
 * How many gaps on each side feed the local median a gap is judged against.
 * Local (not global) so a sustained genuine tempo change — whose gaps dominate
 * their own neighbourhood — is never decimated, while a short burst of
 * double-fires stays a minority in every window that contains it.
 */
const SPURIOUS_WINDOW_RADIUS = 8

/**
 * A beat closer to its predecessor than this fraction of the believed beat
 * period (from the consolidated map) is transition noise — nothing musical is
 * ~2× faster than the tempo in force, not even mid-accelerando (whose gaps
 * shrink gradually and open their own segment once sustained).
 */
const OFF_TEMPO_GAP_FRACTION = 0.55

/**
 * Drop detector noise from a beat grid, in two passes.
 *
 * Pass 1 — double-fires: a beat implausibly close to its predecessor
 * (relative to the LOCAL median gap) is an INSERTED beat, which the tempo-map
 * rupture guard (built for MISSED beats) would read as two confirmed tempo
 * changes, and which grid consumers (metronome click, waveform grid) render
 * as a flam. Within a too-close pair the downbeat wins over a plain beat, so
 * a double-fire landing just before a bar line never evicts the bar anchor.
 *
 * Pass 2 — off-tempo transition noise: beats that pass the local-median floor
 * but contradict the consolidated tempo in force at their instant (a drum
 * fill read as beats between two steady sections). Keep-first here — the
 * downbeat flags of such a region are themselves detector garbage.
 *
 * Dense subdivision runs (a spurious beat after EVERY beat) are out of reach
 * of any median guard — that regime needs a tempo-continuity post-processor
 * upstream.
 */
export function sanitizeBeatGrid(grid: BeatGrid): BeatGrid {
  const plausible = dropDoubleFires(grid)
  const map = consolidateSegments(segmentGaps(plausible))
  return dropTooClose(plausible, (beat) => {
    const bpm = tempoAt(map, beat.timeSeconds)
    // No derivable tempo (under two beats) → NaN floor → everything is kept.
    return (60 / (bpm ?? Number.NaN)) * OFF_TEMPO_GAP_FRACTION
  })
}

/** Pass 1: drop double-fires against the local median gap (downbeat wins). */
function dropDoubleFires(grid: BeatGrid): BeatGrid {
  // Index-free gap walk on purpose: the map idiom's `?? fallback` on
  // `grid[index]` is unreachable and survives mutation testing.
  const gaps: number[] = []
  let previousTime: number | undefined
  for (const beat of grid) {
    if (previousTime !== undefined) {
      gaps.push(beat.timeSeconds - previousTime)
    }
    previousTime = beat.timeSeconds
  }
  return dropTooClose(
    grid,
    // The floor is NaN when the window holds no positive gap (degenerate
    // grid): no beat is provably spurious there, so everything is kept.
    (_, index) => localReferenceGap(gaps, index - 1) * SPURIOUS_GAP_FRACTION,
    { downbeatWins: true }
  )
}

/**
 * Walk the grid keeping beats at least `floorAt` away from the last kept one.
 * With `downbeatWins`, a too-close downbeat replaces a kept plain beat.
 */
function dropTooClose(
  grid: BeatGrid,
  floorAt: (beat: Beat, index: number) => number,
  { downbeatWins = false } = {}
): BeatGrid {
  const kept: Beat[] = []
  grid.forEach((beat, index) => {
    const previous = kept[kept.length - 1]
    if (previous === undefined) {
      kept.push(beat)
      return
    }
    const floor = floorAt(beat, index)
    if (!(beat.timeSeconds - previous.timeSeconds < floor)) {
      kept.push(beat)
    } else if (downbeatWins && beat.downbeat && !previous.downbeat) {
      kept[kept.length - 1] = beat
    }
  })
  return kept
}

/** The median positive gap in a window around `gapIndex` (NaN when none). */
function localReferenceGap(gaps: readonly number[], gapIndex: number): number {
  // Slide the window inward at the edges instead of truncating it: a cluster
  // of double-fires at the very start of the grid must stay a minority of its
  // window, which a half-width window would not guarantee.
  const width = 2 * SPURIOUS_WINDOW_RADIUS + 1
  const start = Math.min(
    Math.max(0, gapIndex - SPURIOUS_WINDOW_RADIUS),
    Math.max(0, gaps.length - width)
  )
  const window = gaps.slice(start, start + width).filter((gap) => gap > 0)
  return median(window)
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
