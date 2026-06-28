/**
 * A render-ready summary of a signal: one min/max envelope per horizontal pixel
 * column ("bucket"). Downsampling lives here so the renderer stays a dumb view
 * and the core can be tested without a canvas.
 */
export interface WaveformPeak {
  readonly min: number
  readonly max: number
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
      peaks.push({ min: 0, max: 0 })
      continue
    }
    // Indices are in bounds by construction; the non-null asserts only satisfy
    // `noUncheckedIndexedAccess` over the `ArrayLike` index signature.
    let min = samples[start] as number
    let max = min
    for (let i = start + 1; i < end; i++) {
      const value = samples[i] as number
      if (value < min) min = value
      if (value > max) max = value
    }
    peaks.push({ min, max })
  }
  return { peaks }
}

/**
 * The sub-envelope visible through a viewport window, given as timeline ratios
 * `[startRatio, endRatio] ⊆ [0, 1]`. Re-renders the existing peaks (no access to
 * the raw samples here); always yields at least one peak so the view never
 * blanks. Pure: a `Waveform` in, a narrower `Waveform` out.
 */
export function sliceWaveform(
  waveform: Waveform,
  startRatio: number,
  endRatio: number
): Waveform {
  const total = waveform.peaks.length
  if (total === 0) {
    return waveform
  }
  // Keep `lo` in bounds so a window flush against the right edge (start ratio 1)
  // still yields its last peak rather than an empty slice.
  const lo = Math.min(Math.floor(clamp01(startRatio) * total), total - 1)
  const hi = Math.ceil(clamp01(endRatio) * total)
  return { peaks: waveform.peaks.slice(lo, Math.max(hi, lo + 1)) }
}

function clamp01(ratio: number): number {
  if (Number.isNaN(ratio) || ratio < 0) {
    return 0
  }
  return Math.min(ratio, 1)
}
