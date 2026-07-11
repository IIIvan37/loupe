import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { BeatGrid, DetectedBeat } from './tempo.ts'
import {
  appendTap,
  buildBeatGrid,
  buildManualGrid,
  buildTempoMap,
  DEFAULT_BEATS_PER_BAR,
  detectMeter,
  foldTempoOctave,
  MAX_MANUAL_BPM,
  MIN_MANUAL_BPM,
  measureIndexAt,
  normalizeManualBpm,
  sanitizeBeatGrid,
  tapTempoBpm,
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

describe('normalizeManualBpm', () => {
  it('accepts a plain tempo unchanged', () => {
    expect(normalizeManualBpm(120)).toBe(120)
  })

  it('rejects zero — an emptied field is not a tempo', () => {
    expect(normalizeManualBpm(0)).toBeUndefined()
  })

  it('rejects a negative tempo', () => {
    expect(normalizeManualBpm(-60)).toBeUndefined()
  })

  it('rejects a non-finite tempo', () => {
    expect(normalizeManualBpm(Number.NaN)).toBeUndefined()
    expect(normalizeManualBpm(Number.POSITIVE_INFINITY)).toBeUndefined()
  })

  it('clamps a crawl to the floor', () => {
    expect(normalizeManualBpm(3)).toBe(MIN_MANUAL_BPM)
  })

  it('clamps a blur to the ceiling', () => {
    expect(normalizeManualBpm(9000)).toBe(MAX_MANUAL_BPM)
  })
})

describe('buildManualGrid', () => {
  it('lays beats at the exact interval from the phase anchor', () => {
    const grid = buildManualGrid({ bpm: 100, phaseSeconds: 0 }, 4, 3)
    expect(grid.map((b) => b.timeSeconds)).toEqual([0, 0.6, 1.2, 1.8, 2.4, 3])
  })

  it('extends the grid back from a positive phase to the track start', () => {
    const grid = buildManualGrid({ bpm: 60, phaseSeconds: 2.5 }, 4, 4)
    expect(grid.map((b) => b.timeSeconds)).toEqual([0.5, 1.5, 2.5, 3.5])
  })

  it('marks the phase anchor as a downbeat', () => {
    const grid = buildManualGrid({ bpm: 60, phaseSeconds: 2 }, 4, 4)
    expect(grid.find((b) => b.timeSeconds === 2)?.downbeat).toBe(true)
  })

  it('marks a downbeat every beatsPerBar, counted through the anchor', () => {
    const grid = buildManualGrid({ bpm: 60, phaseSeconds: 4 }, 3, 8)
    expect(grid.filter((b) => b.downbeat).map((b) => b.timeSeconds)).toEqual([
      1, 4, 7
    ])
  })

  it('keeps every beat inside the track, whatever the phase', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 20, max: 400, noNaN: true }),
        fc.double({ min: -100, max: 100, noNaN: true }),
        fc.integer({ min: 1, max: 12 }),
        fc.double({ min: 0, max: 600, noNaN: true }),
        (bpm, phase, beatsPerBar, duration) => {
          const grid = buildManualGrid(
            { bpm, phaseSeconds: phase },
            beatsPerBar,
            duration
          )
          return grid.every(
            (b) => b.timeSeconds >= 0 && b.timeSeconds <= duration
          )
        }
      )
    )
  })

  it('spaces consecutive beats by exactly 60/bpm', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 20, max: 400, noNaN: true }),
        fc.double({ min: 0, max: 30, noNaN: true }),
        (bpm, phase) => {
          const grid = buildManualGrid({ bpm, phaseSeconds: phase }, 4, 60)
          const interval = 60 / bpm
          return grid.every(
            (b, i) =>
              i === 0 ||
              Math.abs(
                b.timeSeconds - (grid[i - 1]?.timeSeconds ?? 0) - interval
              ) < 1e-9
          )
        }
      )
    )
  })

  it('is empty when the bpm is not a tempo', () => {
    expect(
      buildManualGrid({ bpm: Number.NaN, phaseSeconds: 0 }, 4, 10)
    ).toEqual([])
  })

  it('is empty when the track length is not finite', () => {
    // The guard is what keeps an Infinity duration from looping forever.
    expect(
      buildManualGrid(
        { bpm: 120, phaseSeconds: 0 },
        4,
        Number.POSITIVE_INFINITY
      )
    ).toEqual([])
  })

  it('recovers a beat sitting exactly on zero when the index guess overshoots', () => {
    // bpm 21, phase 15·(60/21): float rounding puts the ceil guess one step
    // above the beat lying exactly on 0 — the back-step correction recovers it.
    const grid = buildManualGrid(
      { bpm: 21, phaseSeconds: 42.857142857142854 },
      4,
      50
    )
    expect(grid[0]?.timeSeconds).toBe(0)
  })

  it('never emits a beat before zero, even for a denormal phase', () => {
    // fast-check counterexample: (-phase·bpm)/60 underflows to 0 for a
    // denormal phase, so the uncorrected start index emitted the (negative)
    // anchor itself.
    const grid = buildManualGrid({ bpm: 20, phaseSeconds: -5e-324 }, 1, 0)
    expect(grid.every((b) => b.timeSeconds >= 0)).toBe(true)
  })

  it('keeps the anchor beat on a zero-length track', () => {
    expect(buildManualGrid({ bpm: 120, phaseSeconds: 0 }, 4, 0)).toEqual([
      { timeSeconds: 0, downbeat: true }
    ])
  })
})

describe('tapTempoBpm', () => {
  it('needs at least two taps to read a tempo', () => {
    expect(tapTempoBpm([])).toBeUndefined()
    expect(tapTempoBpm([1])).toBeUndefined()
  })

  it('reads the tempo from a steady pair', () => {
    expect(tapTempoBpm([0, 0.5])).toBe(120)
  })

  it('takes the median interval, shrugging off one rushed tap', () => {
    // Intervals: 0.5, 0.5, 0.2, 0.5 — median 0.5 → 120, the outlier ignored.
    expect(tapTempoBpm([0, 0.5, 1, 1.2, 1.7])).toBe(120)
  })
})

describe('appendTap', () => {
  it('starts a sequence with the first tap', () => {
    expect(appendTap([], 10)).toEqual([10])
  })

  it('appends a tap within the reset window', () => {
    expect(appendTap([10], 10.5)).toEqual([10, 10.5])
  })

  it('starts over after a silence longer than the reset window', () => {
    expect(appendTap([10, 10.5], 13)).toEqual([13])
  })

  it('keeps a tap landing exactly on the reset window (a 30 BPM feel)', () => {
    expect(appendTap([10], 12)).toEqual([10, 12])
  })

  it('keeps only the most recent taps', () => {
    const taps = Array.from({ length: 8 }, (_, i) => i * 0.5)
    expect(appendTap(taps, 4)).toEqual([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4])
  })
})
