import { describe, expect, it } from 'vitest'
import { buildBeatGrid, DEFAULT_BEATS_PER_BAR } from './tempo.ts'

describe('buildBeatGrid', () => {
  it('marks the first beat as a downbeat', () => {
    const grid = buildBeatGrid([0, 0.5], 4)
    expect(grid[0]).toEqual({ timeSeconds: 0, downbeat: true })
  })

  it('marks a mid-bar beat as not a downbeat', () => {
    const grid = buildBeatGrid([0, 0.5, 1], 4)
    expect(grid[1]).toEqual({ timeSeconds: 0.5, downbeat: false })
  })

  it('marks the start of the next bar as a downbeat', () => {
    const grid = buildBeatGrid([0, 0.5, 1, 1.5, 2], 4)
    expect(grid[4]).toEqual({ timeSeconds: 2, downbeat: true })
  })

  it('honours a different bar length', () => {
    const grid = buildBeatGrid([0, 0.5, 1], 3)
    expect(grid.map((beat) => beat.downbeat)).toEqual([true, false, false])
  })

  it('is empty for no beats', () => {
    expect(buildBeatGrid([], 4)).toEqual([])
  })

  it('defaults to a 4-beat bar', () => {
    expect(DEFAULT_BEATS_PER_BAR).toBe(4)
  })
})
