/**
 * An A/B span of the timeline — the « loupe ». Always normalised so
 * `startSeconds ≤ endSeconds`. Pure data and queries; no clamping to a duration
 * here (the caller clamps drag coordinates).
 */
export interface LoopRegion {
  readonly startSeconds: number
  readonly endSeconds: number
}

/** Build a region from two edges in any order. */
export function makeLoopRegion(a: number, b: number): LoopRegion {
  return a <= b
    ? { startSeconds: a, endSeconds: b }
    : { startSeconds: b, endSeconds: a }
}

export function loopLength(region: LoopRegion): number {
  return region.endSeconds - region.startSeconds
}

/** Half-open `[start, end)` — the start plays, the end is the wrap point. */
export function loopContains(region: LoopRegion, seconds: number): boolean {
  return seconds >= region.startSeconds && seconds < region.endSeconds
}

/**
 * During looped playback the enabled loop confines the playhead: at/after the
 * end it wraps back, and a position left BEFORE the loop (a fresh arm ahead
 * of the cursor, a click outside) is pulled up to the start too.
 */
export function wrapToLoop(region: LoopRegion, seconds: number): number {
  return loopContains(region, seconds) ? seconds : region.startSeconds
}
