/**
 * The middle value of a list (mean of the two middles when even). An EMPTY
 * list yields NaN, on purpose — `localReferenceGap` load-bears on it (a NaN
 * floor keeps every beat); do not "harden" this into a throw.
 */
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  // For an odd length both picks are the same element, so the mean is a no-op.
  const upper = sorted[mid]
  const lower = sorted[sorted.length % 2 === 1 ? mid : mid - 1]
  return ((upper ?? Number.NaN) + (lower ?? Number.NaN)) / 2
}
