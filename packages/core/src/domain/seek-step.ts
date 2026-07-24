import type { BeatGrid } from '../rhythm/domain/beat-grid.ts'
import { adjacentGridTime } from '../rhythm/domain/nudge-time.ts'
import { SEEK_STEP_SECONDS } from './key-bindings.ts'

/**
 * One arrow-key seek of the playhead: to the adjacent beat when a grid
 * exists — the coarse modifier (Shift) widens it to the adjacent bar
 * (downbeat) — and by the legacy fixed hop (5 s) without one, or past the
 * grid's edges where no adjacent unit exists. Unclamped: the caller owns the
 * [0, duration] bounds. The playhead twin of `nudgeSeconds` (loop edges,
 * markers), whose fine fallback is 0.1 s — a seek hops, a nudge trims.
 */
export function seekStepSeconds(
  seconds: number,
  direction: -1 | 1,
  grid: BeatGrid,
  coarse = false
): number {
  return (
    adjacentGridTime(seconds, direction, grid, coarse) ??
    seconds + direction * SEEK_STEP_SECONDS
  )
}
