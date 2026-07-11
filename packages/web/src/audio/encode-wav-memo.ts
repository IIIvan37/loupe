import type { DecodedAudio } from '@app/core'
import { encodeWav } from '@app/core'

/**
 * Encode the mix once per `DecodedAudio` and reuse the bytes: `/tempo`,
 * `/chords` and `/separate` all upload the same WAV, and re-encoding it costs
 * ~100–300 ms of main-thread time (and a ~40 MB allocation) per call. Keyed
 * weakly so the bytes are released with the audio they encode — reserve this
 * for the mix, not per-stem blobs, or every stem's WAV stays resident.
 */
const cache = new WeakMap<DecodedAudio, Uint8Array<ArrayBuffer>>()

export function encodeWavMemo(audio: DecodedAudio): Uint8Array<ArrayBuffer> {
  const hit = cache.get(audio)
  if (hit) {
    return hit
  }
  const wav = encodeWav(audio.channels, audio.sampleRate)
  cache.set(audio, wav)
  return wav
}
