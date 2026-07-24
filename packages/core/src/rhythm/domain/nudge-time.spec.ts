import { describe, expect, it } from 'vitest'
import { meteredGrid } from '../testing/metered-grid-fixture.ts'
import { nudgeSeconds } from './nudge-time.ts'

// Two 4/4 bars, a beat every 0.5s: beats at 0, 0.5, …, 3.5; downbeats at 0 and 2.
const grid = meteredGrid([4, 4])

describe('nudgeSeconds', () => {
  it('moves to the next beat when a grid exists', () => {
    expect(nudgeSeconds(1, 1, grid)).toBe(1.5)
  })

  it('moves to the previous beat when nudging left', () => {
    expect(nudgeSeconds(1, -1, grid)).toBe(0.5)
  })

  it('lands on the grid from an off-beat position', () => {
    expect(nudgeSeconds(1.2, 1, grid)).toBe(1.5)
  })

  it('steps 0.1 s without a grid', () => {
    expect(nudgeSeconds(5, 1, [])).toBe(5.1)
  })

  it('falls back to the fine step past the end of the grid', () => {
    // The grid ends at 3.5 s: beyond it there is no next beat to land on,
    // but the key must still do something useful.
    expect(nudgeSeconds(3.5, 1, grid)).toBe(3.6)
  })

  it('steps a whole bar (next downbeat) with the coarse modifier', () => {
    expect(nudgeSeconds(0.5, 1, grid, true)).toBe(2)
  })

  it('steps back a whole bar with the coarse modifier', () => {
    expect(nudgeSeconds(2.5, -1, grid, true)).toBe(2)
  })

  it('steps 1 s without a grid with the coarse modifier', () => {
    expect(nudgeSeconds(5, 1, [], true)).toBe(6)
  })
})
