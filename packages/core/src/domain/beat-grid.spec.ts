import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  type BeatGrid,
  buildBeatGrid,
  DEFAULT_BEATS_PER_BAR,
  type DetectedBeat,
  detectMeter,
  dominantMeter,
  foldTempoOctave,
  measureIndexAt,
  meterPerMeasure,
  remeterGrid
} from './beat-grid.ts'
import { meteredGrid } from './metered-grid-fixture.ts'

/** Positioned beats (barPosition 1 = downbeat), four to the bar. */
function bar4(times: readonly number[]): readonly DetectedBeat[] {
  return times.map((timeSeconds, index) => ({
    timeSeconds,
    barPosition: (index % 4) + 1
  }))
}

/** A plain grid from bare beat instants (downbeats don't matter here). */
function gridOf(times: readonly number[]): BeatGrid {
  return times.map((timeSeconds) => ({ timeSeconds, downbeat: false }))
}

/** `count` beat instants at a steady bpm, starting at `start`. */
function steadyTimes(bpm: number, count: number, start = 0): number[] {
  const interval = 60 / bpm
  return Array.from({ length: count }, (_, index) => start + index * interval)
}

describe('measureIndexAt', () => {
  // 12 steady beats at 120 bpm, four to the bar: downbeats at 0s, 2s, 4s.
  const grid = buildBeatGrid(bar4(steadyTimes(120, 12)))

  it('reads the playhead inside the first bar as measure 0', () => {
    expect(measureIndexAt(grid, 1)).toBe(0)
  })

  it('reads the playhead inside the second bar as measure 1', () => {
    expect(measureIndexAt(grid, 3)).toBe(1)
  })

  it('reads no measure before the first downbeat (a pickup has no bar yet)', () => {
    const anacrusis = buildBeatGrid(
      bar4(steadyTimes(120, 12, 1)).map((beat, index) => ({
        ...beat,
        barPosition: ((index + 2) % 4) + 1
      }))
    )
    expect(measureIndexAt(anacrusis, 1.2)).toBeUndefined()
  })

  it('enters the bar exactly on its downbeat instant', () => {
    expect(measureIndexAt(grid, 2)).toBe(1)
  })

  it('stays in the last bar past the end of the grid', () => {
    expect(measureIndexAt(grid, 100)).toBe(2)
  })

  it('reads no measure from an empty grid', () => {
    expect(measureIndexAt([], 1)).toBeUndefined()
  })

  it('never decreases as the playhead moves forward', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10, noNaN: true }),
        fc.double({ min: 0, max: 10, noNaN: true }),
        (a, b) => {
          const [before, after] = a <= b ? [a, b] : [b, a]
          const earlier = measureIndexAt(grid, before) ?? -1
          const later = measureIndexAt(grid, after) ?? -1
          return earlier <= later
        }
      )
    )
  })
})

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
  it('reads the meter from a steady four-beat bar', () => {
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

  it('reads the DOMINANT bar length, not the largest position seen', () => {
    // Three four-beat bars around one stray six-beat bar (a detector slip
    // must not promote the whole song to 6 beats).
    const positions = [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 1]
    const beats: readonly DetectedBeat[] = positions.map(
      (barPosition, index) => ({ timeSeconds: index * 0.5, barPosition })
    )
    expect(detectMeter(beats)).toBe(4)
  })

  it('falls back to the largest position before a full bar exists', () => {
    // A single open bar (no second downbeat): the positions are all we have.
    const beats: readonly DetectedBeat[] = [
      { timeSeconds: 0, barPosition: 1 },
      { timeSeconds: 0.5, barPosition: 2 },
      { timeSeconds: 1, barPosition: 3 }
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

describe('meterPerMeasure', () => {
  it('counts the beats of each downbeat interval', () => {
    expect(meterPerMeasure(meteredGrid([4, 2, 4]))).toEqual([4, 2, 4])
  })

  it('counts the last measure to the end of the grid', () => {
    expect(meterPerMeasure(meteredGrid([4, 3]))).toEqual([4, 3])
  })

  it('ignores pickup beats before the first downbeat', () => {
    const pickup: BeatGrid = [
      { timeSeconds: 0, downbeat: false },
      { timeSeconds: 0.5, downbeat: false }
    ]
    expect(meterPerMeasure([...pickup, ...meteredGrid([4])])).toEqual([4])
  })

  it('is empty without a downbeat', () => {
    expect(meterPerMeasure(gridOf([0, 0.5, 1]))).toEqual([])
  })

  it('is empty for an empty grid', () => {
    expect(meterPerMeasure([])).toEqual([])
  })
})

describe('dominantMeter', () => {
  it('picks the most frequent meter', () => {
    expect(dominantMeter([4, 4, 2, 4, 4])).toBe(4)
  })

  it('keeps the first-seen meter on a tie', () => {
    expect(dominantMeter([4, 2, 4, 2])).toBe(4)
  })

  it('falls back to common time when there is no measure', () => {
    expect(dominantMeter([])).toBe(DEFAULT_BEATS_PER_BAR)
  })
})

describe('remeterGrid', () => {
  it('re-flags downbeats every N beats, keeping every instant', () => {
    // A grid misdetected at 6 beats, corrected to 4.
    const wrong = meteredGrid([6, 6])
    const fixed = remeterGrid(wrong, 4)
    expect(fixed.map((beat) => beat.timeSeconds)).toEqual(
      wrong.map((beat) => beat.timeSeconds)
    )
    expect(fixed.map((beat) => beat.downbeat)).toEqual([
      true,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      true,
      false,
      false,
      false
    ])
  })

  it('anchors the new bars on the first existing downbeat', () => {
    // Two pickup beats, then bars: the corrected downbeats keep that phase.
    const pickup: BeatGrid = [
      { timeSeconds: 0, downbeat: false },
      { timeSeconds: 0.5, downbeat: false }
    ]
    const fixed = remeterGrid([...pickup, ...meteredGrid([3, 3])], 2)
    expect(fixed.map((beat) => beat.downbeat)).toEqual([
      false,
      false,
      true,
      false,
      true,
      false,
      true,
      false
    ])
  })

  it('anchors on the first beat when the grid has no downbeat', () => {
    const fixed = remeterGrid(gridOf([0, 0.5, 1, 1.5]), 2)
    expect(fixed.map((beat) => beat.downbeat)).toEqual([
      true,
      false,
      true,
      false
    ])
  })

  it('clamps a degenerate meter to whole bars of at least one beat', () => {
    const fixed = remeterGrid(gridOf([0, 0.5]), 0)
    expect(fixed.map((beat) => beat.downbeat)).toEqual([true, true])
  })

  it('is empty for an empty grid', () => {
    expect(remeterGrid([], 4)).toEqual([])
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
