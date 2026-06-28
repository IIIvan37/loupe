import {
  clampZoom,
  MIN_ZOOM,
  zoomIn as zoomInLevel,
  zoomOut as zoomOutLevel
} from '@app/core'
import { useState } from 'react'

export interface ViewportControl {
  /** Current magnification, 1× … 6×. */
  readonly zoom: number
  readonly zoomIn: () => void
  readonly zoomOut: () => void
  /** Set an absolute level (the slider), clamped. */
  readonly setZoom: (zoom: number) => void
  /** Back to fully zoomed out — e.g. when a new track is loaded. */
  readonly reset: () => void
}

/**
 * Smart hook holding the zoom level. The pure domain owns the clamp + step;
 * horizontal panning lives in the DOM (the waveform's scroll container).
 */
export function useViewport(): ViewportControl {
  const [zoom, setZoomState] = useState(MIN_ZOOM)

  return {
    zoom,
    zoomIn: () => setZoomState(zoomInLevel),
    zoomOut: () => setZoomState(zoomOutLevel),
    setZoom: (next) => setZoomState(clampZoom(next)),
    reset: () => setZoomState(MIN_ZOOM)
  }
}
