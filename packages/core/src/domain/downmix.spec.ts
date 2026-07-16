import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { downmixToMono } from './downmix.ts'

describe('downmixToMono', () => {
  it('averages the channels sample by sample', () => {
    const mono = downmixToMono([
      new Float32Array([1, 0, -1]),
      new Float32Array([0, 0.5, -0.5])
    ])
    expect(Array.from(mono)).toEqual([0.5, 0.25, -0.75])
  })

  it('returns a single channel unchanged (averaged with itself)', () => {
    const mono = downmixToMono([new Float32Array([0.25, -0.5, 1])])
    expect(Array.from(mono)).toEqual([0.25, -0.5, 1])
  })

  it('rejects an empty channel list', () => {
    expect(() => downmixToMono([])).toThrow('at least one channel')
  })

  it('rejects channels of different lengths', () => {
    // A ragged input would read undefined past the shorter channel's end and
    // silently fold NaN into the mix — fail loudly instead.
    expect(() =>
      downmixToMono([new Float32Array([0, 0.5]), new Float32Array([0])])
    ).toThrow('same length')
  })

  it('stays within the amplitude range of its inputs', () => {
    // The average of in-range samples cannot exceed the range — a downmix
    // never clips audio that was not already clipping.
    fc.assert(
      fc.property(
        fc.array(
          fc.array(fc.double({ min: -1, max: 1, noNaN: true }), {
            minLength: 4,
            maxLength: 4
          }),
          { minLength: 1, maxLength: 3 }
        ),
        (channels) => {
          const mono = downmixToMono(channels.map((c) => Float32Array.from(c)))
          expect(mono).toHaveLength(4)
          for (const sample of mono) {
            expect(Math.abs(sample)).toBeLessThanOrEqual(1)
          }
        }
      )
    )
  })
})
