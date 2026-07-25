/**
 * A render-ready summary of a signal: one min/max envelope per horizontal pixel
 * column ("bucket"). Downsampling lives here so the renderer stays a dumb view
 * and the core can be tested without a canvas.
 */
export interface WaveformPeak {
  readonly min: number
  readonly max: number
  /** Root-mean-square of the bucket — the loudness core under the peak tips. */
  readonly rms: number
}

export interface Waveform {
  readonly peaks: ReadonlyArray<WaveformPeak>
}

/**
 * Reduce raw samples to `bucketCount` min/max envelopes. Samples are split into
 * contiguous, evenly sized buckets; a bucket with no samples (more buckets than
 * samples) reads as a flat zero. Pure: an `ArrayLike` in, a `Waveform` out.
 */
export function buildWaveform(
  samples: ArrayLike<number>,
  bucketCount: number
): Waveform {
  if (!Number.isInteger(bucketCount) || bucketCount < 1) {
    throw new Error('bucket count must be a positive integer')
  }

  const total = samples.length
  const peaks: WaveformPeak[] = []
  for (let bucket = 0; bucket < bucketCount; bucket++) {
    const start = Math.floor((bucket * total) / bucketCount)
    const end = Math.floor(((bucket + 1) * total) / bucketCount)
    if (end <= start) {
      peaks.push({ min: 0, max: 0, rms: 0 })
      continue
    }
    // Indices are in bounds by construction; the non-null asserts only satisfy
    // `noUncheckedIndexedAccess` over the `ArrayLike` index signature.
    let min = samples[start] as number
    let max = min
    let energy = min * min
    for (let i = start + 1; i < end; i++) {
      const value = samples[i] as number
      if (value < min) min = value
      if (value > max) max = value
      energy += value * value
    }
    peaks.push({ min, max, rms: Math.sqrt(energy / (end - start)) })
  }
  return { peaks }
}
