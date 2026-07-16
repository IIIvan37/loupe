import type { AudioFileDecoder, DecodedAudio } from '@app/core'
import { rememberAudioBuffer } from './audio-buffer-memo.ts'
import { decodedAudioFrom } from './web-audio-shared.ts'

/**
 * Driven adapter for the `AudioFileDecoder` port: turns encoded audio bytes into
 * PCM with the Web Audio API. The only place in the app that touches
 * `AudioContext` / `decodeAudioData`; the pure core never sees it.
 */
/**
 * Whether playing an AudioBuffer keeps previously-obtained `getChannelData`
 * views valid. The spec's « acquire the contents » lets a UA detach them —
 * which would zero `loadedAudio` (analysis, save, export) the first time an
 * engine plays the shared decode buffer. Chrome shares the storage (verified
 * on 150); a detaching UA fails this one-shot offline probe and the decoder
 * then never registers the pairing — every engine keeps copying (pre-V.5).
 */
async function sharingKeepsViewsValid(): Promise<boolean> {
  try {
    const ctx = new OfflineAudioContext(1, 2, 8000)
    const buffer = ctx.createBuffer(1, 2, 8000)
    const view = buffer.getChannelData(0)
    view[0] = 1
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start()
    await ctx.startRendering()
    return view.length === 2 && buffer.getChannelData(0)[0] === 1
  } catch {
    return false
  }
}

export function createWebAudioDecoder(): AudioFileDecoder {
  let context: AudioContext | undefined
  let shareable: Promise<boolean> | undefined

  return {
    async decode(bytes: ArrayBuffer): Promise<DecodedAudio> {
      // Lazily created and reused — an AudioContext is a scarce, costly resource.
      context ??= new AudioContext()
      shareable ??= sharingKeepsViewsValid()
      // `decodeAudioData` detaches its input buffer, so decode a copy and keep
      // the caller's bytes intact.
      const buffer = await context.decodeAudioData(bytes.slice(0))
      const decoded = decodedAudioFrom(buffer)
      // The decoded channels are views into `buffer`'s storage: remember the
      // pairing so the engines replay this very buffer instead of copying the
      // PCM again (V.5 — see audio-buffer-memo.ts), on UAs where playing it
      // provably keeps the views alive.
      if (await shareable) {
        rememberAudioBuffer(decoded, buffer)
      }
      return decoded
    }
  }
}
