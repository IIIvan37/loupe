import type { DecodedAudio } from '@app/core'
import type { SoundTouchNode } from '@soundtouchjs/audio-worklet'

/** SoundTouch worklet processor (pure JS), copied to `public/`. */
const SOUNDTOUCH_PROCESSOR_URL = '/soundtouch-processor.js'

/** The tempo/pitch shift a SoundTouch master node applies to its input. */
export interface StretchParams {
  readonly timeRatio: number
  readonly pitchSemitones: number
}

/**
 * Copy decoded PCM into a Web Audio buffer on the given context. Shared by the
 * single-track and stem playback adapters, which fill buffers identically. At
 * least one channel and one frame keep `createBuffer` from throwing on silence.
 */
export function audioBufferFrom(
  ctx: AudioContext,
  audio: DecodedAudio
): AudioBuffer {
  const channelCount = Math.max(audio.channels.length, 1)
  const frames = Math.max(audio.channels[0]?.length ?? 0, 1)
  const buffer = ctx.createBuffer(channelCount, frames, audio.sampleRate)
  audio.channels.forEach((channel, index) => {
    buffer.copyToChannel(Float32Array.from(channel as ArrayLike<number>), index)
  })
  return buffer
}

/**
 * Lazily build the SoundTouch master node — register the worklet, connect it to
 * the destination and apply the current tempo/pitch. Returns `undefined` when the
 * worklet is unavailable (node/test path, or a load failure), so both adapters
 * fall back to plain output with the tempo/pitch controls inert. Untested (jsdom
 * has no AudioWorklet) — verified in a real browser.
 */
export async function loadSoundTouchNode(
  ctx: AudioContext,
  params: StretchParams
): Promise<SoundTouchNode | undefined> {
  try {
    // Loaded lazily (browser only): the worklet class extends AudioWorkletNode,
    // which does not exist in the test/node path.
    const { SoundTouchNode } = await import('@soundtouchjs/audio-worklet')
    await SoundTouchNode.register(ctx, SOUNDTOUCH_PROCESSOR_URL)
    const node = new SoundTouchNode({ context: ctx })
    node.connect(ctx.destination)
    node.playbackRate.value = params.timeRatio
    node.pitchSemitones.value = params.pitchSemitones
    return node
  } catch {
    return undefined
  }
}
