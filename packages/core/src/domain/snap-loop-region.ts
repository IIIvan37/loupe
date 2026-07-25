import type { BeatGrid } from '../rhythm/domain/beat-grid.ts'
import { nearestTime } from '../shared/nearest-time.ts'
import type { LoopRegion } from './loop-region.ts'
import { makeLoopRegion } from './loop-region.ts'

/** The musical resolution a loop edge snaps to. */
export type SnapUnit = 'beat' | 'bar'

export function snapLoopRegionToGrid(
  region: LoopRegion,
  grid: BeatGrid,
  unit: SnapUnit
): LoopRegion {
  const times = grid
    .filter((beat) => unit === 'beat' || beat.downbeat)
    .map((beat) => beat.timeSeconds)
  const start = snapEdge(times, region.startSeconds)
  const end = snapEdge(times, region.endSeconds)
  if (start === end) {
    const next = times.find((time) => time > start)
    if (next !== undefined) return makeLoopRegion(start, next)
    const previous = times.findLast((time) => time < end)
    if (previous !== undefined) return makeLoopRegion(previous, end)
  }
  return makeLoopRegion(start, end)
}

/**
 * Snap one edge to its nearest grid point — unless it falls outside the grid's
 * span by more than half the boundary interval (audio the grid never covered,
 * e.g. an outro): there the raw position is the user's intent, keep it.
 */
function snapEdge(times: readonly number[], seconds: number): number {
  const first = times[0]
  if (first === undefined) return seconds
  // A non-empty list has a last element — one emptiness check covers both.
  const last = times.at(-1) as number
  const firstStep = (times[1] ?? first) - first
  const lastStep = last - (times.at(-2) ?? last)
  if (seconds < first - firstStep / 2 || seconds > last + lastStep / 2) {
    return seconds
  }
  return nearestTime(times, seconds)
}
