/**
 * The instant in `times` closest to `seconds` (ties go to the earlier one).
 * Callers guarantee a non-empty list; shared by the section-boundary and
 * loop-edge snapping so "nearest grid point" has one definition.
 */
export function nearestTime(times: readonly number[], seconds: number): number {
  let best = times[0] as number
  for (const time of times) {
    if (Math.abs(time - seconds) < Math.abs(best - seconds)) {
      best = time
    }
  }
  return best
}
