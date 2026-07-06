import { describe, expect, it } from 'vitest'
import type { DetectedBeat } from './tempo.ts'
import {
  buildBeatGrid,
  DEFAULT_BEATS_PER_BAR,
  detectMeter,
  foldTempoOctave
} from './tempo.ts'

/** Positioned beats (barPosition 1 = downbeat), four to the bar. */
function bar4(times: readonly number[]): readonly DetectedBeat[] {
  return times.map((timeSeconds, index) => ({
    timeSeconds,
    barPosition: (index % 4) + 1
  }))
}

describe('buildBeatGrid', () => {
  it('marks a beat at bar position 1 as a downbeat', () => {
    const grid = buildBeatGrid([{ timeSeconds: 0, barPosition: 1 }])
    expect(grid[0]).toEqual({ timeSeconds: 0, downbeat: true })
  })

  it('marks a mid-bar beat as not a downbeat', () => {
    const grid = buildBeatGrid([{ timeSeconds: 0.5, barPosition: 2 }])
    expect(grid[0]).toEqual({ timeSeconds: 0.5, downbeat: false })
  })

  it('follows the detected downbeats rather than counting from the first beat', () => {
    // A pickup beat: the bar starts on the SECOND beat, not the first.
    const grid = buildBeatGrid([
      { timeSeconds: 0, barPosition: 4 },
      { timeSeconds: 0.5, barPosition: 1 },
      { timeSeconds: 1, barPosition: 2 }
    ])
    expect(grid.map((beat) => beat.downbeat)).toEqual([false, true, false])
  })

  it('is empty for no beats', () => {
    expect(buildBeatGrid([])).toEqual([])
  })
})

describe('detectMeter', () => {
  it('reads the meter as the largest bar position seen', () => {
    expect(detectMeter(bar4([0, 0.5, 1, 1.5, 2]))).toBe(4)
  })

  it('detects a three-beat bar', () => {
    const beats: readonly DetectedBeat[] = [
      { timeSeconds: 0, barPosition: 1 },
      { timeSeconds: 0.5, barPosition: 2 },
      { timeSeconds: 1, barPosition: 3 },
      { timeSeconds: 1.5, barPosition: 1 }
    ]
    expect(detectMeter(beats)).toBe(3)
  })

  it('falls back to common time when there are no beats', () => {
    expect(detectMeter([])).toBe(DEFAULT_BEATS_PER_BAR)
  })

  it('defaults to a 4-beat bar', () => {
    expect(DEFAULT_BEATS_PER_BAR).toBe(4)
  })
})

describe('foldTempoOctave', () => {
  it('halves the bpm when dividing by two', () => {
    const folded = foldTempoOctave(
      { bpm: 120, grid: buildBeatGrid(bar4([0, 0.5])) },
      0.5
    )
    expect(folded.bpm).toBe(60)
  })

  it('doubles the bpm when multiplying by two', () => {
    const folded = foldTempoOctave(
      { bpm: 120, grid: buildBeatGrid(bar4([0, 0.5])) },
      2
    )
    expect(folded.bpm).toBe(240)
  })

  it('drops every other beat when dividing by two', () => {
    const folded = foldTempoOctave(
      { bpm: 120, grid: buildBeatGrid(bar4([0, 0.5, 1, 1.5, 2])) },
      0.5
    )
    expect(folded.grid.map((beat) => beat.timeSeconds)).toEqual([0, 1, 2])
  })

  it('inserts a beat at each midpoint when multiplying by two', () => {
    const folded = foldTempoOctave(
      { bpm: 120, grid: buildBeatGrid(bar4([0, 0.5, 1])) },
      2
    )
    expect(folded.grid.map((beat) => beat.timeSeconds)).toEqual([
      0, 0.25, 0.5, 0.75, 1
    ])
  })

  it('keeps a downbeat at the same instant when doubling (preserves phase)', () => {
    const folded = foldTempoOctave(
      { bpm: 120, grid: buildBeatGrid(bar4([0, 0.5, 1, 1.5, 2])) },
      2
    )
    // The original downbeat at t=2 stays a downbeat; the inserted midpoints don't.
    const downbeatTimes = folded.grid
      .filter((beat) => beat.downbeat)
      .map((beat) => beat.timeSeconds)
    expect(downbeatTimes).toEqual([0, 2])
  })

  it('keeps retained downbeats when halving', () => {
    const folded = foldTempoOctave(
      { bpm: 120, grid: buildBeatGrid(bar4([0, 0.5, 1, 1.5, 2])) },
      0.5
    )
    expect(folded.grid[0]?.downbeat).toBe(true)
    expect(folded.grid[2]?.downbeat).toBe(true)
  })

  it('leaves an empty grid empty', () => {
    const folded = foldTempoOctave({ bpm: 120, grid: [] }, 2)
    expect(folded.grid).toEqual([])
  })
})
