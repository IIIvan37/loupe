/**
 * The waveform magnification level — the « loupe »'s zoom. A pure scalar in
 * `[MIN_ZOOM, MAX_ZOOM]`; panning is left to the scroll container in the view, so
 * the domain only owns the clamp and the step.
 */
export const MIN_ZOOM = 1
export const MAX_ZOOM = 6
// Half-step zoom, matching the slider's granularity (1× … 6× in 0.5 increments).
export const ZOOM_STEP = 0.5

/** Clamp any value (incl. NaN) into the valid zoom range. */
export function clampZoom(zoom: number): number {
  if (Number.isNaN(zoom) || zoom < MIN_ZOOM) {
    return MIN_ZOOM
  }
  return Math.min(zoom, MAX_ZOOM)
}

/** The next zoom level up, clamped. */
export function zoomIn(zoom: number): number {
  return clampZoom(zoom + ZOOM_STEP)
}

/** The next zoom level down, clamped. */
export function zoomOut(zoom: number): number {
  return clampZoom(zoom - ZOOM_STEP)
}
