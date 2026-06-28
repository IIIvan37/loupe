/**
 * A windowed view of the timeline — the zoom + scroll state behind the
 * « loupe » magnification. Pure data in normalised timeline space: the whole
 * track is the ratio range [0, 1], independent of its duration in seconds.
 *
 * - `zoom` magnifies: at zoom z the window shows a `1 / z`-wide slice.
 * - `offset` is the left edge of that window, a fraction of the whole timeline.
 */
export interface Viewport {
  readonly zoom: number
  readonly offset: number
}

export const MIN_ZOOM = 1
export const MAX_ZOOM = 6

/** Fully zoomed out, anchored at the left edge. */
export function initialViewport(): Viewport {
  return { zoom: MIN_ZOOM, offset: 0 }
}

/** The largest valid offset at this zoom — the right edge can't pass 1. */
export function maxOffset(viewport: Viewport): number {
  return 1 - 1 / viewport.zoom
}

/** The visible slice as timeline ratios `[start, end] ⊆ [0, 1]`. */
export function visibleWindow(viewport: Viewport): {
  readonly start: number
  readonly end: number
} {
  return { start: viewport.offset, end: viewport.offset + 1 / viewport.zoom }
}

/**
 * Re-zoom while keeping `anchorRatio` (a timeline ratio, e.g. the playhead)
 * pinned under the same on-screen position. The new offset is clamped, so at
 * the edges the anchor drifts rather than scrolling past the track.
 */
export function zoomTo(
  viewport: Viewport,
  zoom: number,
  anchorRatio: number
): Viewport {
  const nextZoom = clampZoom(zoom)
  const screen = toViewRatio(viewport, anchorRatio)
  const offset = anchorRatio - screen / nextZoom
  return { zoom: nextZoom, offset: clampOffset(nextZoom, offset) }
}

/** Move the window so its left edge sits at `offset` (clamped). */
export function scrollTo(viewport: Viewport, offset: number): Viewport {
  return { ...viewport, offset: clampOffset(viewport.zoom, offset) }
}

/** Shift the window by `delta` (clamped). */
export function scrollBy(viewport: Viewport, delta: number): Viewport {
  return scrollTo(viewport, viewport.offset + delta)
}

/** Timeline ratio → position within the visible window (0 = left, 1 = right). */
export function toViewRatio(viewport: Viewport, timelineRatio: number): number {
  return (timelineRatio - viewport.offset) * viewport.zoom
}

/** Position within the visible window → timeline ratio. Inverse of `toViewRatio`. */
export function toTimelineRatio(viewport: Viewport, viewRatio: number): number {
  return viewport.offset + viewRatio / viewport.zoom
}

function clampZoom(zoom: number): number {
  if (Number.isNaN(zoom) || zoom < MIN_ZOOM) {
    return MIN_ZOOM
  }
  return Math.min(zoom, MAX_ZOOM)
}

function clampOffset(zoom: number, offset: number): number {
  if (Number.isNaN(offset) || offset < 0) {
    return 0
  }
  return Math.min(offset, 1 - 1 / zoom)
}
