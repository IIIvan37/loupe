import type { BeatGrid } from './beat-grid.ts'

/** The fine keyboard step when no grid gives a musical unit. */
export const FINE_NUDGE_SECONDS = 0.1
// The coarse (Shift) multiplier for the fixed step, when no grid exists.
const COARSE_FACTOR = 10

/**
 * The grid time adjacent to `seconds` in `direction` — beats, or downbeats
 * only when `downbeatsOnly` — or undefined where no adjacent unit exists
 * (empty grid, past its edges). The shared musical step of `nudgeSeconds`
 * and `seekStepSeconds`; each keeps its own fixed-step fallback.
 */
export function adjacentGridTime(
  seconds: number,
  direction: -1 | 1,
  grid: BeatGrid,
  downbeatsOnly: boolean
): number | undefined {
  const times = grid
    .filter((beat) => !downbeatsOnly || beat.downbeat)
    .map((beat) => beat.timeSeconds)
  return direction === 1
    ? times.find((time) => time > seconds)
    : times.findLast((time) => time < seconds)
}

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
  const step = coarse ? FINE_NUDGE_SECONDS * COARSE_FACTOR : FINE_NUDGE_SECONDS
  return (
    adjacentGridTime(seconds, direction, grid, coarse) ??
    seconds + direction * step
  )
}
