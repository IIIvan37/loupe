import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { BeatGrid, DetectedBeat } from './tempo.ts'
import {
  buildBeatGrid,
  buildTempoMap,
  DEFAULT_BEATS_PER_BAR,
  detectMeter,
  foldTempoOctave,
  tempoAt
} from './tempo.ts'

/** Positioned beats (barPosition 1 = downbeat), four to the bar. */
function bar4(times: readonly number[]): readonly DetectedBeat[] {
  return times.map((timeSeconds, index) => ({
    timeSeconds,
    barPosition: (index % 4) + 1
  }))
}

/** A plain grid from bare beat instants (downbeats don't matter to the map). */
function gridOf(times: readonly number[]): BeatGrid {
  return times.map((timeSeconds) => ({ timeSeconds, downbeat: false }))
}

/** `count` beat instants at a steady bpm, starting at `start`. */
function steadyTimes(bpm: number, count: number, start = 0): number[] {
  const interval = 60 / bpm
  return Array.from({ length: count }, (_, index) => start + index * interval)
}

describe('buildTempoMap', () => {
  it('reads a steady grid as a single segment', () => {
    expect(buildTempoMap(gridOf(steadyTimes(120, 8)))).toHaveLength(1)
  })

  it('anchors the segment at the first beat instant', () => {
    const map = buildTempoMap(gridOf(steadyTimes(120, 8, 0.4)))
    expect(map[0]?.fromSeconds).toBe(0.4)
  })

  it('derives the segment bpm from the beat intervals', () => {
    const map = buildTempoMap(gridOf(steadyTimes(120, 8)))
    expect(map[0]?.bpm).toBeCloseTo(120, 5)
  })

  it('derives a different bpm from wider intervals', () => {
    const map = buildTempoMap(gridOf(steadyTimes(90, 8)))
    expect(map[0]?.bpm).toBeCloseTo(90, 5)
  })

  it('is empty when the grid has fewer than two beats', () => {
    expect(buildTempoMap(gridOf([1.2]))).toEqual([])
  })

  it('is empty for an empty grid', () => {
    expect(buildTempoMap([])).toEqual([])
  })

  it('reads a two-beat grid from its single gap', () => {
    expect(buildTempoMap(gridOf([0, 0.5]))[0]?.bpm).toBeCloseTo(120, 5)
  })

  it('derives the bpm of a grid that does not start at zero', () => {
    // The seed gap is a DIFFERENCE of instants — a grid offset from zero must
    // not shift it (0.4-anchored 120 BPM stays 120, one segment).
    const map = buildTempoMap(gridOf(steadyTimes(120, 8, 0.4)))
    expect(map[0]?.bpm).toBeCloseTo(120, 5)
  })

  it('starts the new segment gaps at the rupture (median includes the opening gap)', () => {
    // Steady 0.5 s, then gaps 0.7 and 0.75: the second segment's median spans
    // BOTH new gaps (0.725), not just the confirming one.
    const map = buildTempoMap(gridOf([0, 0.5, 1, 1.5, 2, 2.5, 3.2, 3.95]))
    expect(map[1]?.bpm).toBeCloseTo(60 / 0.725, 5)
  })

  it('takes the exact middle gap as the median of an odd count', () => {
    // Gaps 0.5 / 0.51 / 0.52 (within tolerance): the median is 0.51, not an
    // average of neighbours.
    const map = buildTempoMap(gridOf([0, 0.5, 1.01, 1.53]))
    expect(map[0]?.bpm).toBeCloseTo(60 / 0.51, 5)
  })

  it('averages the two middle gaps for an even count', () => {
    // Gaps 0.4 / 0.6 (an unconfirmed final deviation): median = 0.5 → 120 BPM.
    const map = buildTempoMap(gridOf([0, 0.4, 1.0]))
    expect(map[0]?.bpm).toBeCloseTo(120, 5)
  })

  it('scales the tolerance with the beat interval (slow tempo, small jitter)', () => {
    // 30 BPM (2 s gaps) with a confirmed +3% wobble: relative tolerance keeps
    // one segment — an absolute threshold would split here.
    const map = buildTempoMap(gridOf([0, 2, 4.06, 6.12, 8.12]))
    expect(map).toHaveLength(1)
  })

  it('splits a tempo change into two segments', () => {
    const change = steadyTimes(120, 8)
    const last = change[change.length - 1] ?? 0
    const slower = steadyTimes(90, 8, last + 60 / 90)
    expect(buildTempoMap(gridOf([...change, ...slower]))).toHaveLength(2)
  })

  it('starts the new segment at the beat that opens the new spacing', () => {
    // DAW tempo-map convention: a change governs the spacing AFTER it, so the
    // segment starts at the last old-tempo beat — the gap it opens is already 90.
    const change = steadyTimes(120, 8)
    const last = change[change.length - 1] ?? 0
    const slower = steadyTimes(90, 8, last + 60 / 90)
    const map = buildTempoMap(gridOf([...change, ...slower]))
    expect(map[1]?.fromSeconds).toBeCloseTo(last, 5)
  })

  it('reads the new tempo in the second segment', () => {
    const change = steadyTimes(120, 8)
    const last = change[change.length - 1] ?? 0
    const slower = steadyTimes(90, 8, last + 60 / 90)
    const map = buildTempoMap(gridOf([...change, ...slower]))
    expect(map[1]?.bpm).toBeCloseTo(90, 5)
  })

  it('does not split on a lone outlier gap (a missed beat is not a new tempo)', () => {
    // 0.5s intervals with a single 1.0s hole in the middle.
    const withHole = [0, 0.5, 1, 1.5, 2.5, 3, 3.5, 4]
    expect(buildTempoMap(gridOf(withHole))).toHaveLength(1)
  })

  it('keeps the bpm unskewed by the outlier (median interval)', () => {
    const withHole = [0, 0.5, 1, 1.5, 2.5, 3, 3.5, 4]
    expect(buildTempoMap(gridOf(withHole))[0]?.bpm).toBeCloseTo(120, 5)
  })

  it('never splits a steady grid under ±2% jitter', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 60, max: 200 }),
        fc.array(fc.double({ min: -0.02, max: 0.02, noNaN: true }), {
          minLength: 15,
          maxLength: 15
        }),
        (bpm, jitters) => {
          const interval = 60 / bpm
          let at = 0
          const times = [0]
          for (const jitter of jitters) {
            at += interval * (1 + jitter)
            times.push(at)
          }
          return buildTempoMap(gridOf(times)).length === 1
        }
      )
    )
  })

  it('anchors every segment at an instant taken from the grid', () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.double({ min: 0.05, max: 2, noNaN: true }), {
            minLength: 1,
            maxLength: 40
          })
          .map((gaps) => {
            let at = 0
            return [0, ...gaps.map((gap) => (at += gap))]
          }),
        (times) => {
          const map = buildTempoMap(gridOf(times))
          return map.every((segment) =>
            times.some((time) => time === segment.fromSeconds)
          )
        }
      )
    )
  })
})

describe('tempoAt', () => {
  // Lazy so the domain runs inside each test, not at collection time — a
  // collection-time crash can't be attributed to a covering test by Stryker.
  const map = () =>
    buildTempoMap(
      gridOf([...steadyTimes(120, 8), ...steadyTimes(90, 8, 3.5 + 60 / 90)])
    )

  it('reads the first segment tempo at an instant inside it', () => {
    expect(tempoAt(map(), 1.7)).toBeCloseTo(120, 5)
  })

  it('reads the new tempo after the change', () => {
    expect(tempoAt(map(), 6)).toBeCloseTo(90, 5)
  })

  it('reads the initial tempo before the first beat', () => {
    expect(tempoAt(map(), 0)).toBeCloseTo(120, 5)
  })

  it('reads the new tempo exactly at its boundary', () => {
    const boundary = map()[1]?.fromSeconds ?? 0
    expect(tempoAt(map(), boundary)).toBeCloseTo(90, 5)
  })

  it('is undefined on an empty map', () => {
    expect(tempoAt([], 1)).toBeUndefined()
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
