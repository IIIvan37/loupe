import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { overlapAdd, type WindowedPiece } from './overlap-add.ts'

/** Element-wise close comparison (the output is float32). */
function expectClose(actual: Float32Array, expected: readonly number[]): void {
  const values = Array.from(actual)
  expect(values).toHaveLength(expected.length)
  values.forEach((value, i) => {
    expect(value).toBeCloseTo(expected[i] ?? Number.NaN, 5)
  })
}

describe('overlapAdd', () => {
  it('leaves uncovered samples at zero', () => {
    const piece: WindowedPiece = { start: 1, samples: [4, 4], window: [1, 1] }
    expectClose(overlapAdd(4, [piece]), [0, 4, 4, 0])
  })

  it('returns the samples unchanged for one full-cover, strictly-positive window', () => {
    // out[i] = s[i]*w[i] / w[i] = s[i] wherever the window is positive.
    const piece: WindowedPiece = {
      start: 0,
      samples: [1, -0.5, 0.25, 0.75],
      window: [0.5, 1, 1, 0.5]
    }
    expectClose(overlapAdd(4, [piece]), [1, -0.5, 0.25, 0.75])
  })

  it('weighted-averages two overlapping pieces', () => {
    // [0,3) value 1 with window [1,2,1]; [2,5) value 3 with window [1,2,1].
    // index 2 overlaps: (1·1 + 3·1) / (1 + 1) = 2.
    const a: WindowedPiece = { start: 0, samples: [1, 1, 1], window: [1, 2, 1] }
    const b: WindowedPiece = { start: 2, samples: [3, 3, 3], window: [1, 2, 1] }
    expectClose(overlapAdd(5, [a, b]), [1, 1, 2, 3, 3])
  })

  it('rejects a window of a different length than its samples', () => {
    expect(() =>
      overlapAdd(3, [{ start: 0, samples: [1, 2, 3], window: [1, 1] }])
    ).toThrow(/same length/)
  })

  it('rejects a piece that falls outside the output range', () => {
    expect(() =>
      overlapAdd(3, [{ start: 2, samples: [1, 2], window: [1, 1] }])
    ).toThrow(/outside/)
    expect(() =>
      overlapAdd(3, [{ start: -1, samples: [1], window: [1] }])
    ).toThrow(/outside/)
  })

  it('returns an empty buffer for an empty track', () => {
    expect(Array.from(overlapAdd(0, []))).toEqual([])
  })

  it('rejects a non-integer or negative total', () => {
    expect(() => overlapAdd(-1, [])).toThrow(/total samples/)
    expect(() => overlapAdd(1.5, [])).toThrow(/total samples/)
  })

  // Property: a constant signal carried by overlapping, strictly-positive windows is
  // reconstructed as that constant — the weighted average of equal values is that
  // value, whatever the weights, including in the overlap regions.
  it('reconstructs a constant across overlapping windows', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -10, max: 10, noNaN: true }),
        fc.integer({ min: 2, max: 40 }),
        fc.integer({ min: 3, max: 6 }),
        (value, pieceLength, pieceCount) => {
          // stride ≤ pieceLength ⇒ consecutive pieces overlap, gap-free coverage.
          const stride = Math.max(1, Math.floor(pieceLength / 2))
          const total = (pieceCount - 1) * stride + pieceLength
          const pieces: WindowedPiece[] = Array.from(
            { length: pieceCount },
            (_, k) => ({
              start: k * stride,
              samples: new Float32Array(pieceLength).fill(value),
              // Strictly-positive ramp so every covered sample has weight > 0.
              window: Array.from({ length: pieceLength }, (_, i) => i + 1)
            })
          )
          // The pieces tile [0, total) exactly, so every sample reconstructs.
          overlapAdd(total, pieces).forEach((sample) => {
            expect(sample).toBeCloseTo(value, 4)
          })
        }
      )
    )
  })
})
