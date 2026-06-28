import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { buildWaveform, sliceWaveform } from './waveform.ts'

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

describe('sliceWaveform', () => {
  const waveform = buildWaveform([0, 1, 2, 3, 4, 5, 6, 7], 8)

  it('returns the whole waveform for the full [0, 1] window', () => {
    expect(sliceWaveform(waveform, 0, 1)).toEqual(waveform)
  })

  it('keeps only the peaks inside the window', () => {
    // The second quarter of an 8-peak waveform is peaks[2..4).
    expect(sliceWaveform(waveform, 0.25, 0.5).peaks).toEqual(
      waveform.peaks.slice(2, 4)
    )
  })

  it('clamps an out-of-range window to the waveform bounds', () => {
    // A negative start must clamp to 0, not index from the end like Array.slice.
    expect(sliceWaveform(waveform, -0.25, 2)).toEqual(waveform)
  })

  it('never returns an empty slice for a degenerate window', () => {
    // A zero-width window still yields at least one peak to render.
    expect(sliceWaveform(waveform, 0.5, 0.5).peaks).toHaveLength(1)
  })

  it('yields the last peak for a window flush against the right edge', () => {
    // start ratio 1 must clamp to the final peak, not slice past the array.
    expect(sliceWaveform(waveform, 1, 1).peaks).toEqual([waveform.peaks.at(-1)])
  })

  it('passes an empty waveform straight through', () => {
    const empty = { peaks: [] }
    expect(sliceWaveform(empty, 0.2, 0.8)).toBe(empty)
  })

  it('always returns a non-empty in-range sub-slice', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (a, b) => {
          const start = Math.min(a, b)
          const end = Math.max(a, b)
          const { peaks } = sliceWaveform(waveform, start, end)
          expect(peaks.length).toBeGreaterThanOrEqual(1)
          expect(peaks.length).toBeLessThanOrEqual(waveform.peaks.length)
          for (const peak of peaks) {
            expect(waveform.peaks).toContainEqual(peak)
          }
        }
      )
    )
  })
})
