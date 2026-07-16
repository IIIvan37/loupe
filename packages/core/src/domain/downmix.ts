/**
 * Fold decoded channels into one mono signal by averaging them sample by
 * sample — the standard equal-weight downmix. Pure, values in / values out;
 * returned as a `Float32Array` so an adapter can hand it straight to Web
 * Audio or a WAV encoder without copying.
 */
export function downmixToMono(
  channels: ReadonlyArray<ArrayLike<number>>
): Float32Array<ArrayBuffer> {
  const first = channels[0]
  if (first === undefined) {
    throw new Error('at least one channel is required')
  }
  const mono = new Float32Array(first.length)
  for (let i = 0; i < mono.length; i++) {
    let sum = 0
    for (const channel of channels) {
      sum += channel[i] as number
    }
    mono[i] = sum / channels.length
  }
  return mono
}
