import type { DecodedAudio } from '@app/core'
import { encodeWav } from '@app/core'

/**
 * Encode the full-fidelity mix once per `DecodedAudio` and reuse the bytes:
 * `/separate` uploads it (its stems come back to the player, so fidelity
 * matters — analysis endpoints use the smaller `encodeAnalysisWavMemo`), and
 * re-encoding costs ~100–300 ms of main-thread time (and a ~40 MB allocation)
 * per call. Keyed weakly so the bytes are released with the audio they
 * encode — reserve this for the mix, not per-stem blobs, or every stem's WAV
 * stays resident.
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
