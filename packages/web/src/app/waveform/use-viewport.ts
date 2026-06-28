import {
  initialViewport,
  scrollBy,
  scrollTo,
  toTimelineRatio,
  type Viewport,
  zoomTo
} from '@app/core'
import { useState } from 'react'

// One button press steps the magnification by a whole level (1× … 6×).
const ZOOM_STEP = 1

export interface ViewportControl {
  readonly viewport: Viewport
  /** Zoom in/out one step, keeping the current view centre on screen. */
  readonly zoomIn: () => void
  readonly zoomOut: () => void
  /** Move the window's left edge to an absolute offset. */
  readonly scroll: (offset: number) => void
  /** Shift the window by a delta (wheel / trackpad). */
  readonly nudge: (delta: number) => void
  /** Back to fully zoomed out — e.g. when a new track is loaded. */
  readonly reset: () => void
}

// The timeline ratio at the middle of the visible window — always on screen, so
// zooming around it never jumps the view (unlike an off-screen playhead would).
function centreRatio(viewport: Viewport): number {
  return toTimelineRatio(viewport, 0.5)
}

/**
 * Smart hook holding the zoom + scroll state. The pure `Viewport` domain owns
 * the clamping and anchor maths; this just keeps the current value in React.
 */
export function useViewport(): ViewportControl {
  const [viewport, setViewport] = useState<Viewport>(initialViewport)

  return {
    viewport,
    zoomIn: () =>
      setViewport((v) => zoomTo(v, v.zoom + ZOOM_STEP, centreRatio(v))),
    zoomOut: () =>
      setViewport((v) => zoomTo(v, v.zoom - ZOOM_STEP, centreRatio(v))),
    scroll: (offset) => setViewport((v) => scrollTo(v, offset)),
    nudge: (delta) => setViewport((v) => scrollBy(v, delta)),
    reset: () => setViewport(initialViewport)
  }
}
