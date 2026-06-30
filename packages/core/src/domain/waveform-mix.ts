import type { Waveform, WaveformPeak } from './waveform.ts'

/** One stem's envelope weighted by its effective linear gain in the mix. */
export interface WaveformLayer {
  readonly waveform: Waveform
  /** Linear gain (≥ 0); 0 silences the layer. */
  readonly gain: number
}

/** Peaks are normalised to [-1, 1]; a summed mix beyond that reads as clipping. */
const PEAK_LIMIT = 1

function clampPeak(value: number): number {
  if (value > PEAK_LIMIT) {
    return PEAK_LIMIT
  }
  if (value < -PEAK_LIMIT) {
    return -PEAK_LIMIT
  }
  return value
}

/**
 * Sum stem envelopes into one — the waveform of the audible mix. Each layer's
 * min/max is scaled by its gain and added bucket by bucket, then clamped to
 * [-1, 1] (the honest picture of a mix that would clip). Pure: envelopes and
 * gains in, one envelope out. Layers are expected to share a bucket count; the
 * result falls back to the shortest so a ragged input can't read past an end.
 */
export function combineWaveforms(layers: readonly WaveformLayer[]): Waveform {
  if (layers.length === 0) {
    return { peaks: [] }
  }
  const bucketCount = Math.min(
    ...layers.map((layer) => layer.waveform.peaks.length)
  )
  const peaks: WaveformPeak[] = []
  for (let bucket = 0; bucket < bucketCount; bucket++) {
    let min = 0
    let max = 0
    for (const layer of layers) {
      // In bounds by construction (bucket < shortest length).
      const peak = layer.waveform.peaks[bucket] as WaveformPeak
      min += layer.gain * peak.min
      max += layer.gain * peak.max
    }
    peaks.push({ min: clampPeak(min), max: clampPeak(max) })
  }
  return { peaks }
}
