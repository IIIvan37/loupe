import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  loopContains,
  loopLength,
  makeLoopRegion,
  wrapToLoop
} from './loop-region.ts'

describe('makeLoopRegion', () => {
  it('orders the two edges into start ≤ end', () => {
    expect(makeLoopRegion(3, 1)).toEqual({ startSeconds: 1, endSeconds: 3 })
    expect(makeLoopRegion(1, 3)).toEqual({ startSeconds: 1, endSeconds: 3 })
  })

  it('always yields start ≤ end whatever the order', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 600, noNaN: true }),
        fc.double({ min: 0, max: 600, noNaN: true }),
        (a, b) => {
          const region = makeLoopRegion(a, b)
          expect(region.startSeconds).toBeLessThanOrEqual(region.endSeconds)
        }
      )
    )
  })
})

describe('loopLength', () => {
  it('is the span between the edges', () => {
    expect(loopLength(makeLoopRegion(1, 4))).toBe(3)
  })
})

describe('loopContains', () => {
  const region = makeLoopRegion(2, 5)

  it('includes the start but excludes the end', () => {
    expect(loopContains(region, 2)).toBe(true)
    expect(loopContains(region, 4.9)).toBe(true)
    expect(loopContains(region, 5)).toBe(false)
    expect(loopContains(region, 1)).toBe(false)
  })
})

describe('wrapToLoop', () => {
  const region = makeLoopRegion(2, 5)

  it('jumps back to the start once the end is reached', () => {
    expect(wrapToLoop(region, 5)).toBe(2)
    expect(wrapToLoop(region, 6)).toBe(2)
  })

  it('leaves a position inside the loop untouched', () => {
    expect(wrapToLoop(region, 3)).toBe(3)
  })

  it('pulls a position before the loop up to its start (the loop confines)', () => {
    // Product rule: while a loop is enabled the playhead belongs to it — a
    // cursor left (or clicked) outside is repositioned at the loop start.
    expect(wrapToLoop(region, 1)).toBe(2)
  })
})
