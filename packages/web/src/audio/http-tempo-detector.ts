import type {
  DecodedAudio,
  DetectedBeat,
  DetectedTempo,
  TempoDetector
} from '@app/core'
import { DEFAULT_BEATS_PER_BAR, encodeWav } from '@app/core'

/** One beat as the enriched tempo endpoint reports it: instant + bar position. */
interface PositionedBeat {
  readonly time: number
  readonly position: number
}

/**
 * The tempo endpoint's JSON shape: BPM plus the beats. The enriched contract
 * carries a bar position per beat (`{ time, position }`); a legacy librosa
 * server still answers with bare seconds, which we tolerate by counting.
 */
interface TempoResponse {
  readonly bpm: number
  readonly beats: readonly (number | PositionedBeat)[]
}

function isPositioned(beat: number | PositionedBeat): beat is PositionedBeat {
  return typeof beat === 'object' && beat !== null
}

/** Map the endpoint's beats into positioned domain beats, counting when needed. */
function toDetectedBeats(
  beats: TempoResponse['beats']
): readonly DetectedBeat[] {
  return beats.map((beat, index) =>
    isPositioned(beat)
      ? { timeSeconds: beat.time, barPosition: beat.position }
      : // Legacy shape: no downbeats — assume common time from the first beat.
        {
          timeSeconds: beat,
          barPosition: (index % DEFAULT_BEATS_PER_BAR) + 1
        }
  )
}

/**
 * Driven adapter for `TempoDetector`: offloads beat tracking to the local
 * server (the same one that runs Demucs), which analyses the uploaded mix WAV
 * and answers with `{ bpm, beats }`. The pure core never knows the DSP ran
 * off-device, nor whether the beats arrived positioned or as bare seconds.
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
      return { bpm: body.bpm, beats: toDetectedBeats(body.beats) }
    }
  }
}
