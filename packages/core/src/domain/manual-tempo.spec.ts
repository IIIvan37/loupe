import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  appendTap,
  buildManualGrid,
  MAX_MANUAL_BPM,
  MIN_MANUAL_BPM,
  normalizeManualBpm,
  tapTempoBpm
} from './manual-tempo.ts'

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
