import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { BeatGrid } from './beat-grid.ts'
import { buildTempoMap, sanitizeBeatGrid, tempoAt } from './tempo-map.ts'

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

  it('reads a grid with one spurious inserted beat as a single segment', () => {
    // 75 BPM (0.8 s gaps) with a detector double-fire 80 ms after a real beat:
    // an INSERTED beat, not a missed one — it must not open a 750 BPM segment.
    const withParasite = [0, 0.8, 1.6, 1.68, 2.4, 3.2, 4, 4.8]
    expect(buildTempoMap(gridOf(withParasite))).toHaveLength(1)
  })

  it('keeps the felt tempo right after the spurious beat at the real bpm', () => {
    // Without the guard this instant reads 60/0.08 = 750 BPM.
    const withParasite = [0, 0.8, 1.6, 1.68, 2.4, 3.2, 4, 4.8]
    expect(tempoAt(buildTempoMap(gridOf(withParasite)), 2)).toBeCloseTo(75, 5)
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

  it('ignores a short noise run between two steady sections', () => {
    // The « Don't Stop Me Now » transition: between the ~100 BPM intro and the
    // ~158 BPM body, the detector misreads the drum fill (three ~0.3 s gaps,
    // then a missed beat). Two confirmed gaps must not be enough to believe a
    // tempo — the fill must not surface as 200 and 68 BPM micro-segments.
    const intro = steadyTimes(100, 11)
    const last = intro[intro.length - 1] ?? 0
    const fill = [last + 0.3, last + 0.58, last + 0.9, last + 1.78]
    const fillEnd = fill[fill.length - 1] ?? 0
    const body = Array.from(
      { length: 11 },
      (_, index) => fillEnd + (index + 1) * 0.38
    )
    const map = buildTempoMap(gridOf([...intro, ...fill, ...body]))
    expect(map.map((segment) => Math.round(segment.bpm))).toEqual([100, 158])
  })

  it('believes a tempo change held for a full bar (four gaps)', () => {
    // Exactly four 0.4 s gaps between two 0.6 s sections: the minimum run a
    // tempo change needs to be believed — one gap fewer is transition noise.
    const before = steadyTimes(100, 11)
    const last = before[before.length - 1] ?? 0
    const change = Array.from(
      { length: 4 },
      (_, index) => last + (index + 1) * 0.4
    )
    const changeEnd = change[change.length - 1] ?? 0
    const after = Array.from(
      { length: 11 },
      (_, index) => changeEnd + (index + 1) * 0.6
    )
    const map = buildTempoMap(gridOf([...before, ...change, ...after]))
    expect(map.map((segment) => Math.round(segment.bpm))).toEqual([
      100, 150, 100
    ])
  })

  it('keeps a genuine sustained tempo change beyond the spurious threshold', () => {
    // 60 BPM then a real 160 BPM section (ratio 2.67×): a sustained fast
    // section is a tempo change, not a run of double-fires — no beat may be
    // dropped, so the second segment must read 160, not a decimated 80.
    const slow = steadyTimes(60, 16)
    const last = slow[slow.length - 1] ?? 0
    const fast = steadyTimes(160, 16, last + 60 / 160)
    const map = buildTempoMap(gridOf([...slow, ...fast]))
    expect(map[map.length - 1]?.bpm).toBeCloseTo(160, 5)
  })

  it('reads the base tempo whatever spurious beats are inserted', () => {
    // The « Somebody to Love » invariant: double-fires inserted anywhere in a
    // steady grid must never surface as a segment of their own.
    fc.assert(
      fc.property(
        fc.integer({ min: 60, max: 200 }),
        fc.uniqueArray(fc.integer({ min: 0, max: 10 }), {
          minLength: 1,
          maxLength: 3
        }),
        fc.double({ min: 0.05, max: 0.35, noNaN: true }),
        (bpm, parasiteAfter, offsetFraction) => {
          const interval = 60 / bpm
          const times = steadyTimes(bpm, 12).flatMap((time, index) =>
            parasiteAfter.includes(index)
              ? [time, time + offsetFraction * interval]
              : [time]
          )
          const map = buildTempoMap(gridOf(times))
          return map.length === 1 && Math.abs((map[0]?.bpm ?? 0) - bpm) < 1e-6
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

describe('sanitizeBeatGrid', () => {
  const times = (grid: BeatGrid): number[] =>
    grid.map((beat) => beat.timeSeconds)

  it('drops a spurious beat inserted right after a real one', () => {
    const grid = gridOf([0, 0.8, 1.6, 1.68, 2.4, 3.2])
    expect(times(sanitizeBeatGrid(grid))).toEqual([0, 0.8, 1.6, 2.4, 3.2])
  })

  it('keeps the downbeat of a too-close pair, not the spurious fire before it', () => {
    // The double-fire lands 80 ms BEFORE the real downbeat: keeping the first
    // of the pair would shift the bar anchor early and orphan the downbeat.
    const grid: BeatGrid = [
      { timeSeconds: 0, downbeat: true },
      { timeSeconds: 0.72, downbeat: false },
      { timeSeconds: 0.8, downbeat: true },
      { timeSeconds: 1.6, downbeat: false },
      { timeSeconds: 2.4, downbeat: false }
    ]
    expect(times(sanitizeBeatGrid(grid))).toEqual([0, 0.8, 1.6, 2.4])
  })

  it('collapses duplicate beat instants', () => {
    // A zero gap must count as spurious, not poison the median with zeros.
    const grid = gridOf([0, 0, 0.5, 0.5, 1, 1])
    expect(times(sanitizeBeatGrid(grid))).toEqual([0, 0.5, 1])
  })

  it('leaves a clean steady grid untouched', () => {
    const grid = gridOf(steadyTimes(120, 8))
    expect(sanitizeBeatGrid(grid)).toEqual(grid)
  })

  it('drops transition beats faster than the believed tempo', () => {
    // The « Don't Stop Me Now » 28 s flam: the drum fill emits beats ~0.3 s
    // apart (bogus downbeats included) in a 100 BPM region. They pass the
    // double-fire floor (0.4× the ~0.5 s local median) but contradict the
    // consolidated tempo — the metronome must not click them.
    const intro = steadyTimes(100, 16)
    const last = intro[intro.length - 1] ?? 0
    const fill: BeatGrid = [
      { timeSeconds: last + 0.3, downbeat: true },
      { timeSeconds: last + 0.58, downbeat: true },
      { timeSeconds: last + 0.9, downbeat: true }
    ]
    const holeEnd = last + 1.78
    const body = Array.from({ length: 9 }, (_, index) => holeEnd + index * 0.38)
    const grid: BeatGrid = [...gridOf(intro), ...fill, ...gridOf(body)]
    expect(times(sanitizeBeatGrid(grid))).toEqual([
      ...intro,
      last + 0.58,
      ...body
    ])
  })

  it('leaves a sustained genuine fast section untouched', () => {
    // Same shape as the buildTempoMap tempo-change case: sustained sections
    // survive, only short bursts read as double-fires.
    const slow = steadyTimes(60, 16)
    const last = slow[slow.length - 1] ?? 0
    const fast = steadyTimes(160, 16, last + 60 / 160)
    const grid = gridOf([...slow, ...fast])
    expect(sanitizeBeatGrid(grid)).toEqual(grid)
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
