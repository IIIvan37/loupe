import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  clampZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
  zoomIn,
  zoomOut
} from './viewport.ts'

describe('clampZoom', () => {
  it('keeps a value already in range', () => {
    expect(clampZoom(3)).toBe(3)
  })

  it('clamps below MIN_ZOOM and above MAX_ZOOM', () => {
    expect(clampZoom(0.1)).toBe(MIN_ZOOM)
    expect(clampZoom(100)).toBe(MAX_ZOOM)
  })

  it('treats NaN as fully zoomed out', () => {
    expect(clampZoom(Number.NaN)).toBe(MIN_ZOOM)
  })

  it('always lands within [MIN_ZOOM, MAX_ZOOM]', () => {
    fc.assert(
      fc.property(fc.double({ min: -100, max: 100, noNaN: true }), (zoom) => {
        const result = clampZoom(zoom)
        expect(result).toBeGreaterThanOrEqual(MIN_ZOOM)
        expect(result).toBeLessThanOrEqual(MAX_ZOOM)
      })
    )
  })
})

describe('zoomIn / zoomOut', () => {
  it('steps by ZOOM_STEP within bounds', () => {
    expect(zoomIn(3)).toBe(3 + ZOOM_STEP)
    expect(zoomOut(3)).toBe(3 - ZOOM_STEP)
  })

  it('cannot step past the extremes', () => {
    expect(zoomIn(MAX_ZOOM)).toBe(MAX_ZOOM)
    expect(zoomOut(MIN_ZOOM)).toBe(MIN_ZOOM)
  })

  it('is reversible in the middle of the range', () => {
    expect(zoomOut(zoomIn(3))).toBe(3)
  })
})
