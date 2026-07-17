import type { Beat, BeatGrid } from './beat-grid.ts'
import { median } from './median.ts'

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
 * How far a beat interval may stray from its segment's median before it reads
 * as a tempo change rather than jitter (relative, ±8%).
 */
const TEMPO_RUPTURE_TOLERANCE = 0.08

/**
 * Derive the tempo map from the beat grid's instants. Pure — the grid is the
 * single source of truth (persisted with the project), the map is re-derived
 * wherever it's needed.
 */
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
    const previous = kept.at(-1)
    if (previous === undefined) {
      kept.push(beat)
      return
    }
    const floor = floorAt(beat, index)
    if (beat.timeSeconds - previous.timeSeconds >= floor) {
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
