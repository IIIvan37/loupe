interface FollowScrollTopInput {
  /** Current measure's bounds in the scrollport's inner pixel space. */
  readonly measureTop: number
  readonly measureBottom: number
  readonly scrollTop: number
  readonly clientHeight: number
  readonly scrollHeight: number
}

/**
 * Sheet page-follow, scoped to ONE scrollport: decide whether the panel must
 * scroll to keep the playing measure visible. `nearest` semantics — a visible
 * measure returns null ("don't touch the scroll"), a clipped one aligns to its
 * closest edge. The vertical twin of the waveform's followScrollLeft, replacing
 * scrollIntoView whose scroll walks EVERY ancestor and drags the page along.
 */
export function followScrollTop(input: FollowScrollTopInput): number | null {
  const { measureTop, measureBottom, scrollTop, clientHeight, scrollHeight } =
    input
  const clamp = (top: number) =>
    Math.max(0, Math.min(top, scrollHeight - clientHeight))
  if (measureTop < scrollTop) {
    return clamp(measureTop)
  }
  // An oversized measure aligns to its top: showing its start beats its end.
  if (measureBottom > scrollTop + clientHeight) {
    return clamp(Math.min(measureTop, measureBottom - clientHeight))
  }
  return null
}
