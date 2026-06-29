import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { planChunks, planSegments, transitionWindow } from './segment-plan.ts'

/** Element-wise close comparison — the window is float32, the maths is float64. */
function expectWindow(actual: Float32Array, expected: readonly number[]): void {
  const values = Array.from(actual)
  expect(values).toHaveLength(expected.length)
  values.forEach((value, i) => {
    expect(value).toBeCloseTo(expected[i] ?? Number.NaN, 6)
  })
}

describe('planSegments', () => {
  it('returns a single truncated window when the track is shorter than a segment', () => {
    expect(planSegments(100, 343980, 85995)).toEqual([
      { start: 0, length: 100 }
    ])
  })

  it('returns one window when the track fits within the first stride', () => {
    // stride = 10 - 4 = 6 ≥ 6 samples → the second window would start past the end.
    expect(planSegments(6, 10, 4)).toEqual([{ start: 0, length: 6 }])
  })

  it('still emits an overlapping tail window when the track is exactly a segment', () => {
    // total 10 = segmentLength, stride 6 → a redundant but correct [6, 10) tail.
    expect(planSegments(10, 10, 4)).toEqual([
      { start: 0, length: 10 },
      { start: 6, length: 4 }
    ])
  })

  it('steps by the stride and truncates the final window', () => {
    // stride = 10 - 4 = 6 → starts 0, 6, 12; the last covers only [12, 15).
    expect(planSegments(15, 10, 4)).toEqual([
      { start: 0, length: 10 },
      { start: 6, length: 9 },
      { start: 12, length: 3 }
    ])
  })

  it('tiles exactly with no overlap', () => {
    expect(planSegments(20, 10, 0)).toEqual([
      { start: 0, length: 10 },
      { start: 10, length: 10 }
    ])
  })

  it('produces no window for an empty track', () => {
    expect(planSegments(0, 10, 4)).toEqual([])
    expect(planSegments(-5, 10, 4)).toEqual([])
  })

  it('rejects a non-positive or non-integer segment length', () => {
    expect(() => planSegments(10, 0, 0)).toThrow(/segment length/)
    expect(() => planSegments(10, -1, 0)).toThrow(/segment length/)
    expect(() => planSegments(10, 1.5, 0)).toThrow(/segment length/)
  })

  it('rejects an overlap outside [0, segmentLength)', () => {
    expect(() => planSegments(10, 8, -1)).toThrow(/overlap/)
    expect(() => planSegments(10, 8, 8)).toThrow(/overlap/)
    expect(() => planSegments(10, 8, 2.5)).toThrow(/overlap/)
  })

  // Property: the windows cover every sample with no gap, stepping by a constant
  // stride, and only the last one is truncated — what overlap-add needs.
  it('covers the whole track gap-free, stepping by a constant stride', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2000 }),
        fc.integer({ min: 2, max: 200 }),
        fc.integer({ min: 0, max: 199 }),
        (total, segmentLength, overlapRaw) => {
          const overlap = overlapRaw % segmentLength
          const stride = segmentLength - overlap
          const segments = planSegments(total, segmentLength, overlap)

          expect(segments.length).toBeGreaterThan(0)
          const covered = new Array<boolean>(total).fill(false)
          let expectedStart = 0
          let lastEnd = 0
          for (const seg of segments) {
            expect(seg.start).toBe(expectedStart)
            expect(seg.length).toBe(Math.min(segmentLength, total - seg.start))
            for (let i = seg.start; i < seg.start + seg.length; i++) {
              covered[i] = true
            }
            expectedStart += stride
            lastEnd = seg.start + seg.length
          }
          // Every sample is reached, and the last window touches the very end.
          expect(covered.every(Boolean)).toBe(true)
          expect(lastEnd).toBe(total)
        }
      )
    )
  })
})

describe('planChunks', () => {
  it('splits the track into chunk-sized windows that overlap by the context', () => {
    // stride = ceil(100/4) = 25, segmentLength = 25 + 10 = 35.
    expect(planChunks(100, 4, 10)).toEqual([
      { start: 0, length: 35 },
      { start: 25, length: 35 },
      { start: 50, length: 35 },
      { start: 75, length: 25 }
    ])
  })

  it('yields a single full-length window for one chunk', () => {
    expect(planChunks(100, 1, 10)).toEqual([{ start: 0, length: 100 }])
  })

  it('produces no window for an empty track', () => {
    expect(planChunks(0, 4, 10)).toEqual([])
  })

  it('rejects a non-positive chunk count or context', () => {
    expect(() => planChunks(100, 0, 10)).toThrow(/chunk count/)
    expect(() => planChunks(100, 1.5, 10)).toThrow(/chunk count/)
    expect(() => planChunks(100, 4, 0)).toThrow(/context/)
    expect(() => planChunks(100, 4, 1.5)).toThrow(/context/)
  })

  // Property: ≤ chunkCount windows, gap-free coverage, neighbours overlap by context.
  it('covers the track with at most chunkCount overlapping windows', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000 }),
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 1, max: 200 }),
        (total, chunkCount, context) => {
          const chunks = planChunks(total, chunkCount, context)

          expect(chunks.length).toBeGreaterThan(0)
          expect(chunks.length).toBeLessThanOrEqual(chunkCount)
          const covered = new Array<boolean>(total).fill(false)
          chunks.forEach((chunk, index) => {
            for (let i = chunk.start; i < chunk.start + chunk.length; i++) {
              covered[i] = true
            }
            // Each window but the last overlaps its successor — by `context` when
            // full-length, less when the track is shorter than a full segment.
            const next = chunks[index + 1]
            if (next) {
              const overlap = chunk.start + chunk.length - next.start
              expect(overlap).toBeGreaterThan(0)
              expect(overlap).toBeLessThanOrEqual(context)
            }
          })
          expect(covered.every(Boolean)).toBe(true)
        }
      )
    )
  })
})

describe('transitionWindow', () => {
  it('ramps up over the overlap, holds, then ramps down (normalised to 1)', () => {
    // segmentLength 8, overlap 3 → unnormalised min(i+1, 8-i, 3):
    // [1,2,3,3,3,3,2,1] / 3.
    expectWindow(transitionWindow(8, 3), [
      1 / 3,
      2 / 3,
      1,
      1,
      1,
      1,
      2 / 3,
      1 / 3
    ])
  })

  it('degrades to a tent when twice the overlap exceeds the segment', () => {
    // segmentLength 5, overlap 4 → min(i+1, 5-i, 4) = [1,2,3,2,1] / 3: the
    // segment is too short to ever reach the overlap plateau.
    expectWindow(transitionWindow(5, 4), [1 / 3, 2 / 3, 1, 2 / 3, 1 / 3])
  })

  it('rejects a non-positive or non-integer segment length', () => {
    expect(() => transitionWindow(0, 1)).toThrow(/segment length/)
    expect(() => transitionWindow(1.5, 1)).toThrow(/segment length/)
  })

  it('rejects an overlap outside [1, segmentLength]', () => {
    expect(() => transitionWindow(8, 0)).toThrow(/overlap/)
    expect(() => transitionWindow(8, 9)).toThrow(/overlap/)
    expect(() => transitionWindow(8, 2.5)).toThrow(/overlap/)
  })

  // Property: a valid blending window is the right length, strictly positive,
  // symmetric, and peaks at exactly 1.
  it('is a normalised, strictly-positive, symmetric window', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 300 }),
        fc.integer({ min: 1, max: 300 }),
        (segmentLength, overlapRaw) => {
          const overlap = 1 + (overlapRaw % segmentLength)
          const values = Array.from(transitionWindow(segmentLength, overlap))

          expect(values).toHaveLength(segmentLength)
          let max = 0
          values.forEach((value, i) => {
            expect(value).toBeGreaterThan(0)
            expect(value).toBeLessThanOrEqual(1)
            expect(value).toBeCloseTo(
              values[segmentLength - 1 - i] ?? Number.NaN,
              6
            )
            if (value > max) {
              max = value
            }
          })
          expect(max).toBeCloseTo(1, 6)
        }
      )
    )
  })
})
