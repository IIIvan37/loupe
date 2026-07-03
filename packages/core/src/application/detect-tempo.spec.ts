import { describe, expect, it } from 'vitest'
import { detectTempo } from './detect-tempo.ts'
import type { DecodedAudio, TempoDetector } from './ports.ts'

const audio: DecodedAudio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }

/** Fake detector: returns a fixed tempo, recording the audio it was handed. */
function fakeDetector(
  bpm: number,
  beatsSeconds: readonly number[]
): TempoDetector & { seen: DecodedAudio | undefined } {
  const state = { seen: undefined as DecodedAudio | undefined }
  return {
    ...state,
    async detect(given) {
      state.seen = given
      return { bpm, beatsSeconds }
    },
    get seen() {
      return state.seen
    }
  }
}

describe('detectTempo', () => {
  it('reports the detected tempo', async () => {
    const result = await detectTempo(
      { audio },
      { detector: fakeDetector(120, [0, 0.5, 1, 1.5]) }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(result.analysis.bpm).toBe(120)
  })

  it('builds a beat grid marking every fourth beat as a downbeat', async () => {
    const result = await detectTempo(
      { audio, beatsPerBar: 4 },
      { detector: fakeDetector(120, [0, 0.5, 1, 1.5, 2]) }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(result.analysis.grid).toEqual([
      { timeSeconds: 0, downbeat: true },
      { timeSeconds: 0.5, downbeat: false },
      { timeSeconds: 1, downbeat: false },
      { timeSeconds: 1.5, downbeat: false },
      { timeSeconds: 2, downbeat: true }
    ])
  })

  it('defaults to a 4-beat bar when no meter is given', async () => {
    const result = await detectTempo(
      { audio },
      { detector: fakeDetector(120, [0, 0.5, 1, 1.5, 2]) }
    )
    if (!result.ok) throw new Error('expected ok')
    // The 5th beat opens the next bar — only the default (4) makes it a downbeat.
    expect(result.analysis.grid[4]?.downbeat).toBe(true)
  })

  it('hands the detector the same PCM it was given', async () => {
    const detector = fakeDetector(90, [])
    await detectTempo({ audio }, { detector })
    expect(detector.seen).toBe(audio)
  })

  it('returns an error result when the detector throws', async () => {
    const boom: TempoDetector = {
      detect: async () => {
        throw new Error('tempo engine down')
      }
    }
    const result = await detectTempo({ audio }, { detector: boom })
    expect(result).toEqual({ ok: false, error: 'tempo engine down' })
  })
})
