import type { DecodedAudio } from '@app/core'
import { type StereoChannels, TARGET_SAMPLE_RATE } from './audio-format.ts'

/**
 * Bring any decoded audio to the shape the separator needs: stereo at 44.1 kHz.
 * Resampling and channel up/down-mixing are delegated to `OfflineAudioContext`,
 * the browser's own high-quality resampler — far better than a hand-rolled linear
 * interpolation, and it handles mono → stereo (the model requires two channels).
 */
export async function toStereo44100(
  audio: DecodedAudio
): Promise<StereoChannels> {
  const sourceLength = audio.channels[0]?.length ?? 0
  if (sourceLength === 0) {
    return { left: new Float32Array(0), right: new Float32Array(0) }
  }

  // Fast path: already stereo at the target rate — copy the channels, skip the
  // OfflineAudioContext render (and its sub-sample resampler group delay) entirely.
  const [sourceLeft, sourceRight] = audio.channels
  if (
    audio.sampleRate === TARGET_SAMPLE_RATE &&
    audio.channels.length === 2 &&
    sourceLeft &&
    sourceRight
  ) {
    return {
      left: Float32Array.from(sourceLeft),
      right: Float32Array.from(sourceRight)
    }
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
