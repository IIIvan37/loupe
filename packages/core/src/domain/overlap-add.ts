/**
 * Weighted overlap-add: blend windowed pieces of a signal back into one buffer.
 * The parallel separator runs each chunk through its own worker, then stitches the
 * results here — pure values-in/values-out, so the seam-blending DSP stays in the
 * core. Each piece contributes `samples[i]·window[i]` at `start + i`, and the final
 * divide by the accumulated window weight turns overlaps into a true weighted
 * average.
 */

/** One placed, windowed slice of the output. `window` is per-sample blend weight. */
export interface WindowedPiece {
  readonly start: number
  readonly samples: ArrayLike<number>
  readonly window: ArrayLike<number>
}

export function overlapAdd(
  totalSamples: number,
  pieces: readonly WindowedPiece[]
): Float32Array {
  if (!Number.isInteger(totalSamples) || totalSamples < 0) {
    throw new Error('total samples must be a non-negative integer')
  }

  const out = new Float32Array(totalSamples)
  const weight = new Float32Array(totalSamples)
  for (const { start, samples, window } of pieces) {
    if (window.length !== samples.length) {
      throw new Error('piece window and samples must be the same length')
    }
    if (start < 0 || start + samples.length > totalSamples) {
      throw new Error('piece falls outside the output range')
    }
    for (let i = 0; i < samples.length; i++) {
      const at = start + i
      const w = window[i] ?? 0
      out[at] = (out[at] ?? 0) + (samples[i] ?? 0) * w
      weight[at] = (weight[at] ?? 0) + w
    }
  }

  // Normalise overlaps to a weighted average; uncovered samples stay 0.
  for (let i = 0; i < totalSamples; i++) {
    const w = weight[i] ?? 0
    if (w > 0) {
      out[i] = (out[i] ?? 0) / w
    }
  }
  return out
}
