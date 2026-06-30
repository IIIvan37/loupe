import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { Waveform } from './waveform.ts'
import { combineWaveforms } from './waveform-mix.ts'

function wave(...peaks: ReadonlyArray<[number, number]>): Waveform {
  return { peaks: peaks.map(([min, max]) => ({ min, max })) }
}

describe('combineWaveforms', () => {
  it('returns an empty envelope for no layers', () => {
    expect(combineWaveforms([])).toEqual({ peaks: [] })
  })

  it('passes a single unity layer through (already in range)', () => {
    const w = wave([-0.5, 0.5], [-0.2, 0.8])
    expect(combineWaveforms([{ waveform: w, gain: 1 }])).toEqual(w)
  })

  it('scales a layer by its gain', () => {
    const w = wave([-0.4, 0.6])
    expect(combineWaveforms([{ waveform: w, gain: 0.5 }])).toEqual(
      wave([-0.2, 0.3])
    )
  })

  it('sums the layers bucket by bucket', () => {
    const a = wave([-0.3, 0.3], [-0.1, 0.1])
    const b = wave([-0.2, 0.2], [-0.4, 0.4])
    expect(
      combineWaveforms([
        { waveform: a, gain: 1 },
        { waveform: b, gain: 1 }
      ])
    ).toEqual(wave([-0.5, 0.5], [-0.5, 0.5]))
  })

  it('clamps the summed envelope to [-1, 1] (clipping)', () => {
    const a = wave([-0.8, 0.8])
    const b = wave([-0.8, 0.8])
    expect(
      combineWaveforms([
        { waveform: a, gain: 1 },
        { waveform: b, gain: 1 }
      ])
    ).toEqual(wave([-1, 1]))
  })

  it('falls back to the shortest layer length', () => {
    const a = wave([0, 0.1], [0, 0.2], [0, 0.3])
    const b = wave([0, 0.1])
    expect(
      combineWaveforms([
        { waveform: a, gain: 1 },
        { waveform: b, gain: 1 }
      ]).peaks
    ).toHaveLength(1)
  })

  it('silences everything when every gain is zero', () => {
    const a = wave([-0.5, 0.5], [-0.9, 0.9])
    expect(combineWaveforms([{ waveform: a, gain: 0 }])).toEqual(
      wave([0, 0], [0, 0])
    )
  })

  // Property: the combined envelope always stays within [-1, 1].
  it('always stays within [-1, 1]', () => {
    const peakArb = fc.tuple(
      fc.double({ min: -1, max: 0, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true })
    )
    const layerArb = fc.record({
      waveform: fc
        .array(peakArb, { minLength: 1, maxLength: 8 })
        .map((peaks) => wave(...peaks)),
      gain: fc.double({ min: 0, max: 2, noNaN: true })
    })
    fc.assert(
      fc.property(fc.array(layerArb, { maxLength: 5 }), (layers) => {
        for (const peak of combineWaveforms(layers).peaks) {
          expect(peak.min).toBeGreaterThanOrEqual(-1)
          expect(peak.max).toBeLessThanOrEqual(1)
        }
      })
    )
  })
})
