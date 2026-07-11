interface FollowScrollInput {
  /** Playhead position in the inner's pixel space. */
  readonly playheadX: number
  readonly scrollLeft: number
  readonly clientWidth: number
  readonly scrollWidth: number
}

/**
 * DAW page-follow: decide whether the stage must scroll to keep the playhead
 * visible. Returns the new scrollLeft only when the playhead has left the
 * visible window — null means "don't touch the scroll this frame".
 */
export function followScrollLeft(input: FollowScrollInput): number | null {
  const { playheadX, scrollLeft, clientWidth, scrollWidth } = input
  if (playheadX >= scrollLeft + clientWidth || playheadX < scrollLeft) {
    return Math.max(0, Math.min(playheadX, scrollWidth - clientWidth))
  }
  return null
}
