import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { makeLoopRegion } from './loop-region.ts'
import { meteredGrid } from './metered-grid-fixture.ts'
import { snapLoopRegionToGrid } from './snap-loop-region.ts'

const arbGrid = fc
  .record({
    meters: fc.array(fc.integer({ min: 1, max: 7 }), { maxLength: 8 }),
    beatSeconds: fc.double({ min: 0.2, max: 1, noNaN: true })
  })
  .map(({ meters, beatSeconds }) => meteredGrid(meters, beatSeconds))

const arbRegion = fc
  .tuple(
    fc.double({ min: 0, max: 60, noNaN: true }),
    fc.double({ min: 0, max: 60, noNaN: true })
  )
  .map(([a, b]) => makeLoopRegion(a, b))

const arbUnit = fc.constantFrom('beat' as const, 'bar' as const)

// Two 4/4 bars, a beat every 0.5s: beats at 0, 0.5, …, 3.5; downbeats at 0 and 2.
const grid = meteredGrid([4, 4])

describe('snapLoopRegionToGrid', () => {
  it('snaps each edge to the nearest beat', () => {
    expect(
      snapLoopRegionToGrid(makeLoopRegion(0.6, 2.4), grid, 'beat')
    ).toEqual(makeLoopRegion(0.5, 2.5))
  })

  it('rounds an edge up when the next beat is closer', () => {
    expect(
      snapLoopRegionToGrid(makeLoopRegion(0.9, 3.3), grid, 'beat')
    ).toEqual(makeLoopRegion(1, 3.5))
  })

  it('snaps to downbeats only in bar unit', () => {
    expect(snapLoopRegionToGrid(makeLoopRegion(0.6, 2.4), grid, 'bar')).toEqual(
      makeLoopRegion(0, 2)
    )
  })

  it('keeps a collapsed region one unit long (end moves to the next beat)', () => {
    expect(
      snapLoopRegionToGrid(makeLoopRegion(0.6, 0.7), grid, 'beat')
    ).toEqual(makeLoopRegion(0.5, 1))
  })

  it('pulls the start back instead when collapsing on the last beat', () => {
    expect(
      snapLoopRegionToGrid(makeLoopRegion(3.4, 3.5), grid, 'beat')
    ).toEqual(makeLoopRegion(3, 3.5))
  })

  it('leaves an edge past the grid untouched (an outro is not yanked back)', () => {
    // The grid ends at 3.5s; an edge dropped at 5s is over half a beat past
    // the last beat — the user is looping into ungridded audio, respect it.
    expect(snapLoopRegionToGrid(makeLoopRegion(2.4, 5), grid, 'beat')).toEqual(
      makeLoopRegion(2.5, 5)
    )
  })

  it('leaves the region untouched without a grid (callers snap unconditionally)', () => {
    fc.assert(
      fc.property(arbRegion, arbUnit, (region, unit) => {
        expect(snapLoopRegionToGrid(region, [], unit)).toEqual(region)
      })
    )
  })

  it('always yields start ≤ end', () => {
    fc.assert(
      fc.property(arbGrid, arbRegion, arbUnit, (anyGrid, region, unit) => {
        const snapped = snapLoopRegionToGrid(region, anyGrid, unit)
        expect(snapped.startSeconds).toBeLessThanOrEqual(snapped.endSeconds)
      })
    )
  })

  it('is idempotent (snapping a snapped region changes nothing)', () => {
    fc.assert(
      fc.property(arbGrid, arbRegion, arbUnit, (anyGrid, region, unit) => {
        const once = snapLoopRegionToGrid(region, anyGrid, unit)
        expect(snapLoopRegionToGrid(once, anyGrid, unit)).toEqual(once)
      })
    )
  })
})
