/** Clamp a ratio into [0, 1], treating NaN (a not-yet-known value) as 0. */
export function clamp01(ratio: number): number {
  if (Number.isNaN(ratio) || ratio < 0) {
    return 0
  }
  return Math.min(ratio, 1)
}
