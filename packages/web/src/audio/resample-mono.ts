import { audioBufferFrom } from './web-audio-shared.ts'

/**
 * Resample a mono signal with `OfflineAudioContext` — the browser's native,
 * off-main-thread resampler. Humble object: no logic beyond wiring the Web
 * Audio graph, excluded from coverage (jsdom has no OfflineAudioContext) and
 * verified in a real browser.
 */

export type ResampleMono = (
  samples: Float32Array<ArrayBuffer>,
  fromRate: number,
  toRate: number
) => Promise<Float32Array>

/**
 * The runtime's resampler, or undefined where Web Audio is missing (jsdom) —
 * callers then upload at the source rate and keep only the mono saving.
 */
export function createOfflineContextResampler(): ResampleMono | undefined {
  if (typeof OfflineAudioContext === 'undefined') {
    return undefined
  }
  return async (samples, fromRate, toRate) => {
    const frames = Math.ceil((samples.length * toRate) / fromRate)
    const context = new OfflineAudioContext(1, frames, toRate)
    const source = context.createBufferSource()
    source.buffer = audioBufferFrom(context, {
      sampleRate: fromRate,
      channels: [samples]
    })
    source.connect(context.destination)
    source.start()
    const rendered = await context.startRendering()
    return rendered.getChannelData(0)
  }
}
