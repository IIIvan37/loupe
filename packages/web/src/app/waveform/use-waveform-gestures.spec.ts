import type { BeatGrid } from '@app/core'
import { describe, expect, it } from 'vitest'
import { snappedEdgeRatios } from './use-waveform-gestures.ts'

// A beat per second from 0 to 8 s; downbeats every fourth beat.
const grid: BeatGrid = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((timeSeconds) => ({
  timeSeconds,
  downbeat: timeSeconds % 4 === 0
}))

describe('snappedEdgeRatios', () => {
  it('returns the ratios of both edges after they snap to the nearest beat', () => {
    // 2.3 s → 2 s (0.2) and 5.7 s → 6 s (0.6) on the 10 s timeline.
    expect(snappedEdgeRatios(0.23, 0.57, grid, 10)).toEqual([0.2, 0.6])
  })

  it('omits an out-of-span edge kept raw (an outro is not snapped)', () => {
    // 9.5 s sits beyond the last beat (8 s) by more than half a step: kept raw,
    // so it does not land on a beat and must not flash. The start still snaps.
    expect(snappedEdgeRatios(0.2, 0.95, grid, 10)).toEqual([0.2])
  })

  it('is empty when there is no grid to snap to', () => {
    expect(snappedEdgeRatios(0.2, 0.6, [], 10)).toEqual([])
  })

  it('is empty when the timeline has no duration', () => {
    expect(snappedEdgeRatios(0.2, 0.6, grid, 0)).toEqual([])
  })
})
