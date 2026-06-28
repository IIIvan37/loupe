import type { AudioFileDecoder, DecodedAudio } from '@app/core'

/**
 * Driven adapter for the `AudioFileDecoder` port: turns encoded audio bytes into
 * PCM with the Web Audio API. The only place in the app that touches
 * `AudioContext` / `decodeAudioData`; the pure core never sees it.
 */
export function createWebAudioDecoder(): AudioFileDecoder {
  let context: AudioContext | undefined

  return {
    async decode(bytes: ArrayBuffer): Promise<DecodedAudio> {
      // Lazily created and reused — an AudioContext is a scarce, costly resource.
      context ??= new AudioContext()
      // `decodeAudioData` detaches its input buffer, so decode a copy and keep
      // the caller's bytes intact.
      const buffer = await context.decodeAudioData(bytes.slice(0))
      const channels: Float32Array[] = []
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        channels.push(buffer.getChannelData(channel))
      }
      return { sampleRate: buffer.sampleRate, channels }
    }
  }
}
