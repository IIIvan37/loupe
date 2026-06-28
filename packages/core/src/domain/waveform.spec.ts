import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { buildWaveform } from './waveform.ts'

describe('buildWaveform', () => {
  it('summarises each bucket as its min/max envelope', () => {
    const waveform = buildWaveform([0, 1, -1, 0.5], 2)
    expect(waveform.peaks).toEqual([
      { min: 0, max: 1 },
      { min: -1, max: 0.5 }
    ])
  })

  it('finds the extremes wherever they sit inside a bucket', () => {
    // Min is interior, max is non-terminal — neither is the bucket's first or
    // last sample, so both running comparisons must actually fire.
    expect(buildWaveform([0.5, 0.8, -1], 1).peaks).toEqual([
      { min: -1, max: 0.8 }
    ])
  })

  it('produces exactly the requested number of buckets', () => {
    expect(buildWaveform([0.1, 0.2, 0.3], 1).peaks).toHaveLength(1)
    expect(buildWaveform([0.1, 0.2, 0.3], 3).peaks).toHaveLength(3)
  })

  it('represents an empty bucket as a flat zero envelope', () => {
    // More buckets than samples: a bucket that covers no sample reads as zero.
    // With one sample over two buckets, the even split places it in the second.
    const waveform = buildWaveform([1], 2)
    expect(waveform.peaks).toEqual([
      { min: 0, max: 0 },
      { min: 1, max: 1 }
    ])
  })

  it('represents fully silent input as zeros', () => {
    expect(buildWaveform([], 2).peaks).toEqual([
      { min: 0, max: 0 },
      { min: 0, max: 0 }
    ])
  })

  it('rejects a non-positive or non-integer bucket count', () => {
    expect(() => buildWaveform([0, 1], 0)).toThrow(/bucket/)
    expect(() => buildWaveform([0, 1], -1)).toThrow(/bucket/)
    expect(() => buildWaveform([0, 1], 1.5)).toThrow(/bucket/)
  })

  it('accepts a Float32Array (the adapter passes channel data)', () => {
    const waveform = buildWaveform(Float32Array.of(0, 1, -1, 0.5), 2)
    expect(waveform.peaks).toEqual([
      { min: 0, max: 1 },
      { min: -1, max: 0.5 }
    ])
  })

  // Property: with at most as many buckets as samples, every bucket covers real
  // samples, so each envelope stays inside the global min/max and is well-ordered.
  it('keeps every peak within the signal envelope', () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.float({ min: -1, max: 1, noNaN: true }), { minLength: 1 })
          .chain((samples) =>
            fc.tuple(
              fc.constant(samples),
              fc.integer({ min: 1, max: samples.length })
            )
          ),
        ([samples, bucketCount]) => {
          const { peaks } = buildWaveform(samples, bucketCount)
          const lo = Math.min(...samples)
          const hi = Math.max(...samples)
          expect(peaks).toHaveLength(bucketCount)
          for (const { min, max } of peaks) {
            expect(min).toBeLessThanOrEqual(max)
            expect(min).toBeGreaterThanOrEqual(lo)
            expect(max).toBeLessThanOrEqual(hi)
          }
        }
      )
    )
  })
})
