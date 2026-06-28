import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  initialViewport,
  MAX_ZOOM,
  MIN_ZOOM,
  maxOffset,
  scrollBy,
  scrollTo,
  toTimelineRatio,
  toViewRatio,
  type Viewport,
  visibleWindow,
  zoomTo
} from './viewport.ts'

// A viewport with any valid zoom and offset, for the round-trip properties.
const arbViewport = fc
  .record({
    zoom: fc.double({ min: MIN_ZOOM, max: MAX_ZOOM, noNaN: true }),
    offsetSeed: fc.double({ min: 0, max: 1, noNaN: true })
  })
  .map(({ zoom, offsetSeed }) => {
    const base = zoomTo(initialViewport(), zoom, 0)
    return scrollTo(base, offsetSeed * maxOffset(base))
  })

describe('initialViewport', () => {
  it('starts fully zoomed out at the left edge', () => {
    expect(initialViewport()).toEqual({ zoom: MIN_ZOOM, offset: 0 })
  })
})

describe('zoomTo', () => {
  it('clamps the zoom level into [MIN_ZOOM, MAX_ZOOM]', () => {
    expect(zoomTo(initialViewport(), 100, 0.5).zoom).toBe(MAX_ZOOM)
    expect(zoomTo(initialViewport(), 0.1, 0.5).zoom).toBe(MIN_ZOOM)
  })

  it('keeps the anchor under the same screen position', () => {
    const zoomed = zoomTo(initialViewport(), 3, 0.5)
    // The anchor sat at the centre (view ratio 0.5) and should stay there.
    expect(toViewRatio(zoomed, 0.5)).toBeCloseTo(0.5)
  })

  it('preserves the anchor or pins the offset to an edge', () => {
    fc.assert(
      fc.property(
        arbViewport,
        fc.double({ min: MIN_ZOOM, max: MAX_ZOOM, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (viewport, targetZoom, anchor) => {
          const screenBefore = toViewRatio(viewport, anchor)
          const next = zoomTo(viewport, targetZoom, anchor)
          const screenAfter = toViewRatio(next, anchor)
          const pinned = next.offset === 0 || next.offset === maxOffset(next)
          expect(pinned || Math.abs(screenAfter - screenBefore) < 1e-9).toBe(
            true
          )
        }
      )
    )
  })
})

describe('scrollTo / scrollBy', () => {
  it('clamps the offset within [0, maxOffset]', () => {
    const viewport = zoomTo(initialViewport(), 2, 0)
    expect(scrollTo(viewport, -1).offset).toBe(0)
    expect(scrollTo(viewport, 99).offset).toBe(maxOffset(viewport))
  })

  it('never scrolls a fully-zoomed-out viewport', () => {
    expect(scrollTo(initialViewport(), 0.5).offset).toBe(0)
  })

  it('shifts the offset by the delta, still clamped', () => {
    const viewport = scrollTo(zoomTo(initialViewport(), 4, 0), 0.2)
    expect(scrollBy(viewport, 0.1).offset).toBeCloseTo(0.3)
    expect(scrollBy(viewport, -1).offset).toBe(0)
  })

  it('always lands inside the valid offset range', () => {
    fc.assert(
      fc.property(
        arbViewport,
        fc.double({ min: -2, max: 2, noNaN: true }),
        (viewport, delta) => {
          const offset = scrollBy(viewport, delta).offset
          expect(offset).toBeGreaterThanOrEqual(0)
          expect(offset).toBeLessThanOrEqual(maxOffset(viewport) + 1e-9)
        }
      )
    )
  })
})

describe('visibleWindow', () => {
  it('spans the whole timeline at zoom 1', () => {
    expect(visibleWindow(initialViewport())).toEqual({ start: 0, end: 1 })
  })

  it('shows a 1/zoom-wide slice at the current offset', () => {
    const viewport = scrollTo(zoomTo(initialViewport(), 4, 0), 0.25)
    expect(visibleWindow(viewport)).toEqual({ start: 0.25, end: 0.5 })
  })
})

describe('toViewRatio / toTimelineRatio round-trip', () => {
  it('maps timeline ↔ view ratios reversibly', () => {
    fc.assert(
      fc.property(
        arbViewport,
        fc.double({ min: 0, max: 1, noNaN: true }),
        (viewport, timelineRatio) => {
          const back = toTimelineRatio(
            viewport,
            toViewRatio(viewport, timelineRatio)
          )
          expect(back).toBeCloseTo(timelineRatio)
        }
      )
    )
  })

  it('maps view ↔ timeline ratios reversibly', () => {
    fc.assert(
      fc.property(
        arbViewport,
        fc.double({ min: 0, max: 1, noNaN: true }),
        (viewport, viewRatio) => {
          const back = toViewRatio(
            viewport,
            toTimelineRatio(viewport, viewRatio)
          )
          expect(back).toBeCloseTo(viewRatio)
        }
      )
    )
  })

  it('places the window edges at view ratios 0 and 1', () => {
    const viewport: Viewport = scrollTo(zoomTo(initialViewport(), 3, 0), 0.2)
    const { start, end } = visibleWindow(viewport)
    expect(toViewRatio(viewport, start)).toBeCloseTo(0)
    expect(toViewRatio(viewport, end)).toBeCloseTo(1)
  })
})
