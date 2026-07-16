import { type DecodedAudio, downmixToMono, encodeWav } from '@app/core'
import {
  createOfflineContextResampler,
  type ResampleMono
} from './resample-mono.ts'

/**
 * The rate the analysis WAV is uploaded at. The highest rate an analysis
 * endpoint actually consumes: structure infers at 24 kHz, chords resamples to
 * 22 050 Hz, beat tracking is rate-agnostic — anything above is upload for
 * nothing (a stereo 44.1 kHz mix is 3.7× the bytes for the same result).
 */
export const ANALYSIS_SAMPLE_RATE = 24000

/**
 * Encode the analysis upload once per `DecodedAudio` and reuse the bytes:
 * `/tempo`, `/chords` and `/structure` post the same mono, downsampled WAV.
 * Distinct from `encodeWavMemo` on purpose — `/separate` must keep the
 * full-fidelity mix (its stems come back to the player), while analysis only
 * reads the signal. Keyed weakly so the bytes are released with the audio.
 */
const cache = new WeakMap<DecodedAudio, Promise<Uint8Array<ArrayBuffer>>>()

export function encodeAnalysisWavMemo(
  audio: DecodedAudio,
  resample: ResampleMono | undefined = createOfflineContextResampler()
): Promise<Uint8Array<ArrayBuffer>> {
  const hit = cache.get(audio)
  if (hit) {
    return hit
  }
  const pending = encodeAnalysisWav(audio, resample)
  cache.set(audio, pending)
  // A failed render must not poison the cache — evict so a retry re-encodes.
  pending.catch(() => cache.delete(audio))
  return pending
}

async function encodeAnalysisWav(
  audio: DecodedAudio,
  resample: ResampleMono | undefined
): Promise<Uint8Array<ArrayBuffer>> {
  const mono = downmixToMono(audio.channels)
  if (resample === undefined || audio.sampleRate <= ANALYSIS_SAMPLE_RATE) {
    return encodeWav([mono], audio.sampleRate)
  }
  const resampled = await resample(mono, audio.sampleRate, ANALYSIS_SAMPLE_RATE)
  return encodeWav([resampled], ANALYSIS_SAMPLE_RATE)
}
