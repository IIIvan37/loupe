import type { DecodedAudio } from '@app/core'
import { encodeWavMemo } from './encode-wav-memo.ts'

/**
 * The POST-a-mix-WAV-get-JSON skeleton the analysis adapters share
 * (`/tempo`, `/chords`): encode the loaded PCM (memoised per audio, shared
 * with `/separate`), upload it, fail loudly on a non-2xx answer. Each
 * adapter keeps only its response-shape guard and mapping — a protocol
 * change (auth, abort, error detail) lands once here.
 */
export async function postWavForJson(
  baseUrl: string,
  path: string,
  audio: DecodedAudio
): Promise<unknown> {
  const wav = encodeWavMemo(audio)
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'audio/wav' },
    body: wav
  })
  if (!response.ok) {
    throw new Error(`${path.slice(1)} request failed: HTTP ${response.status}`)
  }
  return response.json()
}
