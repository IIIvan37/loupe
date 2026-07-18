import { describe, expect, it } from 'vitest'
import { SEEK_STEP_SECONDS } from './key-bindings.ts'
import { seekStepSeconds } from './seek-step.ts'

/** Beats every 0.5 s over 8 s, a downbeat opening each 4-beat bar. */
const grid = Array.from({ length: 16 }, (_, i) => ({
  timeSeconds: i * 0.5,
  bpm: 120,
  downbeat: i % 4 === 0
}))

describe('seekStepSeconds', () => {
  it('steps to the next beat with a grid', () => {
    expect(seekStepSeconds(1.1, 1, grid)).toBe(1.5)
  })

  it('steps to the previous beat with a grid', () => {
    expect(seekStepSeconds(1.1, -1, grid)).toBe(1)
  })

  it('never stalls on a beat — exactly on one moves to the adjacent one', () => {
    expect(seekStepSeconds(1.5, 1, grid)).toBe(2)
    expect(seekStepSeconds(1.5, -1, grid)).toBe(1)
  })

  it('the coarse step lands on downbeats — a measure at a time', () => {
    expect(seekStepSeconds(1.1, 1, grid, true)).toBe(2)
    expect(seekStepSeconds(4.2, -1, grid, true)).toBe(4)
  })

  it('falls back to the fixed hop without a grid', () => {
    expect(seekStepSeconds(12, 1, [])).toBe(12 + SEEK_STEP_SECONDS)
    expect(seekStepSeconds(12, -1, [])).toBe(12 - SEEK_STEP_SECONDS)
  })

  it('falls back to the fixed hop past the grid edges', () => {
    // An outro beyond the last beat still navigates — the grid does not trap.
    expect(seekStepSeconds(7.5, 1, grid)).toBe(7.5 + SEEK_STEP_SECONDS)
    expect(seekStepSeconds(0, -1, grid)).toBe(-SEEK_STEP_SECONDS)
  })

  it('a grid without downbeats degrades the coarse step to the fixed hop', () => {
    const flat = grid.map((beat) => ({ ...beat, downbeat: false }))
    expect(seekStepSeconds(1.1, 1, flat, true)).toBe(1.1 + SEEK_STEP_SECONDS)
  })
})
