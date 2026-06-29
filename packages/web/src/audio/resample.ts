import type { DecodedAudio } from '@app/core'
import { TARGET_SAMPLE_RATE } from './demucs-model.ts'

export interface StereoPcm {
  readonly left: Float32Array
  readonly right: Float32Array
}

/**
 * Bring any decoded audio to the shape the separator needs: stereo at 44.1 kHz.
 * Resampling and channel up/down-mixing are delegated to `OfflineAudioContext`,
 * the browser's own high-quality resampler — far better than a hand-rolled linear
 * interpolation, and it handles mono → stereo (the model requires two channels).
 */
export async function toStereo44100(audio: DecodedAudio): Promise<StereoPcm> {
  const sourceLength = audio.channels[0]?.length ?? 0
  if (sourceLength === 0) {
    return { left: new Float32Array(0), right: new Float32Array(0) }
  }
  const targetLength = Math.max(
    1,
    Math.round((sourceLength * TARGET_SAMPLE_RATE) / audio.sampleRate)
  )

  const context = new OfflineAudioContext(2, targetLength, TARGET_SAMPLE_RATE)
  const source = context.createBuffer(
    audio.channels.length,
    sourceLength,
    audio.sampleRate
  )
  audio.channels.forEach((channel, index) => {
    source.copyToChannel(Float32Array.from(channel), index)
  })

  const node = context.createBufferSource()
  node.buffer = source
  node.connect(context.destination)
  node.start()
  const rendered = await context.startRendering()

  return {
    left: rendered.getChannelData(0),
    right: rendered.getChannelData(1)
  }
}
