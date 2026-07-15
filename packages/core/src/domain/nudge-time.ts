import type { BeatGrid } from './beat-grid.ts'

/** The fine keyboard step when no grid gives a musical unit. */
export const FINE_NUDGE_SECONDS = 0.1
// The coarse (Shift) multiplier for the fixed step, when no grid exists.
const COARSE_FACTOR = 10

/**
 * One keyboard nudge of a timeline position (a loop edge, a marker): to the
 * adjacent beat when a grid exists — the coarse modifier widens it to the
 * adjacent bar (downbeat) — and by a fixed 0.1 s (×10 coarse) without one, or
 * past the grid's edges where no adjacent unit exists. Unclamped: the caller
 * owns the [0, duration] bounds.
 */
export function nudgeSeconds(
  seconds: number,
  direction: -1 | 1,
  grid: BeatGrid,
  coarse = false
): number {
  const times = grid
    .filter((beat) => !coarse || beat.downbeat)
    .map((beat) => beat.timeSeconds)
  const target =
    direction === 1
      ? times.find((time) => time > seconds)
      : times.findLast((time) => time < seconds)
  const step = coarse ? FINE_NUDGE_SECONDS * COARSE_FACTOR : FINE_NUDGE_SECONDS
  return target ?? seconds + direction * step
}
