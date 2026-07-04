import type { DecodedAudio, DetectedTempo, TempoDetector } from '@app/core'
import { encodeWav } from '@app/core'

/** The tempo endpoint's JSON shape: BPM plus beat onset times in seconds. */
interface TempoResponse {
  readonly bpm: number
  readonly beats: readonly number[]
}

/**
 * Driven adapter for `TempoDetector`: offloads beat tracking to the local
 * server (the same one that runs Demucs), which analyses the uploaded mix WAV
 * with a librosa beat tracker and answers with `{ bpm, beats }`. The pure core
 * never knows the DSP ran off-device.
 */
export function createHttpTempoDetector(baseUrl: string): TempoDetector {
  return {
    async detect(audio: DecodedAudio): Promise<DetectedTempo> {
      const wav = encodeWav(audio.channels, audio.sampleRate)
      const response = await fetch(`${baseUrl}/tempo`, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: wav
      })
      if (!response.ok) {
        throw new Error(`tempo request failed: HTTP ${response.status}`)
      }
      const body = (await response.json()) as Partial<TempoResponse>
      if (typeof body.bpm !== 'number' || !Array.isArray(body.beats)) {
        throw new Error('tempo response was malformed')
      }
      return { bpm: body.bpm, beatsSeconds: body.beats }
    }
  }
}
