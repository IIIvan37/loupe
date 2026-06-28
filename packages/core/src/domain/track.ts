import { buildWaveform, type Waveform } from './waveform.ts'

/**
 * A decoded piece of audio reduced to what the player needs: its length, its
 * sample rate, and a render-ready waveform. Holds no raw PCM — the heavy sample
 * buffers stay in the adapter; the core keeps only the summary.
 */
export interface Track {
  readonly sampleRate: number
  readonly durationSeconds: number
  readonly waveform: Waveform
}

/**
 * Assemble a `Track` from decoded channels: mix to mono, summarise into
 * `bucketCount` peaks, derive the duration. Pure — values in, value out.
 */
export function buildTrack(
  channels: ReadonlyArray<ArrayLike<number>>,
  sampleRate: number,
  bucketCount: number
): Track {
  if (channels.length === 0) {
    throw new Error('a track needs at least one channel')
  }
  if (sampleRate <= 0) {
    throw new Error('sample rate must be positive')
  }
  const mono = mixToMono(channels)
  return {
    sampleRate,
    durationSeconds: mono.length / sampleRate,
    waveform: buildWaveform(mono, bucketCount)
  }
}

/** Average the channels sample-by-sample (a single channel averages with itself). */
function mixToMono(channels: ReadonlyArray<ArrayLike<number>>): number[] {
  // `buildTrack` has already rejected the empty case, so channel 0 exists.
  const length = (channels[0] as ArrayLike<number>).length
  const mono = new Array<number>(length)
  for (let i = 0; i < length; i++) {
    let sum = 0
    for (const channel of channels) {
      sum += channel[i] as number
    }
    mono[i] = sum / channels.length
  }
  return mono
}
