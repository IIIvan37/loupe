/** One source feeding the paused mix: its decoded channels and its fader gain. */
export interface MixLayer {
  readonly channels: ReadonlyArray<ArrayLike<number>>
  readonly gain: number
}

/**
 * One mono window of the mix, as the analyser tap would hear it at rest:
 * each layer's channels averaged, weighted by its gain, layers summed.
 * Zero-padded outside the audio (a window at the tail stays a valid FFT
 * input), start clamped to the head. Pure — the paused-spectrum feed for
 * `spectrumFromSamples`.
 */
export function mixWindow(
  layers: ReadonlyArray<MixLayer>,
  startFrame: number,
  length: number
): Float32Array {
  const window = new Float32Array(length)
  const start = Math.max(0, startFrame)
  for (const { channels, gain } of layers) {
    if (gain === 0 || channels.length === 0) {
      continue
    }
    for (let i = 0; i < length; i++) {
      let sum = 0
      for (const channel of channels) {
        sum += Number(channel[start + i] ?? 0)
      }
      window[i] = (window[i] ?? 0) + (gain * sum) / channels.length
    }
  }
  return window
}
