import { type Beat, type BeatGrid, clampBeatsPerBar } from './beat-grid.ts'
import { median } from './median.ts'

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
  const bar = clampBeatsPerBar(beatsPerBar)
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
  const last = taps.at(-1)
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
