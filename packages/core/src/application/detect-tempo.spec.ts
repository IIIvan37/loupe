import { describe, expect, it } from 'vitest'
import type { DetectedBeat } from '../domain/beat-grid.ts'
import { detectTempo, TempoDetectionError } from './detect-tempo.ts'
import type { DecodedAudio, TempoDetector } from './ports.ts'

const audio: DecodedAudio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }

/** Four-to-the-bar positioned beats at the given instants. */
function bar4(times: readonly number[]): readonly DetectedBeat[] {
  return times.map((timeSeconds, index) => ({
    timeSeconds,
    barPosition: (index % 4) + 1
  }))
}

/** Fake detector: returns fixed beats, recording the audio it was handed. */
function fakeDetector(
  bpm: number,
  beats: readonly DetectedBeat[]
): TempoDetector & { seen: DecodedAudio | undefined } {
  const state = { seen: undefined as DecodedAudio | undefined }
  return {
    ...state,
    async detect(given) {
      state.seen = given
      return { bpm, beats }
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
      { detector: fakeDetector(120, bar4([0, 0.5, 1, 1.5])) }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(result.analysis.bpm).toBe(120)
  })

  it('builds a beat grid from the reported bar positions', async () => {
    const result = await detectTempo(
      { audio },
      { detector: fakeDetector(120, bar4([0, 0.5, 1, 1.5, 2])) }
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

  it('sanitizes the detector grid: a double-fire never reaches the analysis', async () => {
    // The detector double-fires 80 ms after a real beat: whatever adapter the
    // payload came through, the analysis grid (metronome click, waveform
    // beats) must not carry the spurious instant.
    const withParasite = bar4([0, 0.8, 1.6, 1.68, 2.4, 3.2])
    const result = await detectTempo(
      { audio },
      { detector: fakeDetector(75, withParasite) }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(result.analysis.grid.map((beat) => beat.timeSeconds)).toEqual([
      0, 0.8, 1.6, 2.4, 3.2
    ])
  })

  it('derives the meter from the reported bar positions', async () => {
    const threeFour: readonly DetectedBeat[] = [
      { timeSeconds: 0, barPosition: 1 },
      { timeSeconds: 0.5, barPosition: 2 },
      { timeSeconds: 1, barPosition: 3 },
      { timeSeconds: 1.5, barPosition: 1 }
    ]
    const result = await detectTempo(
      { audio },
      { detector: fakeDetector(90, threeFour) }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(result.analysis.beatsPerBar).toBe(3)
  })

  it('hands the detector the same PCM it was given', async () => {
    const detector = fakeDetector(90, [])
    await detectTempo({ audio }, { detector })
    expect(detector.seen).toBe(audio)
  })

  it('hands the caller abort signal through to the detector', async () => {
    let seenSignal: AbortSignal | undefined
    const detector: TempoDetector = {
      async detect(_given, signal) {
        seenSignal = signal
        return { bpm: 90, beats: [] }
      }
    }
    const controller = new AbortController()
    await detectTempo({ audio, signal: controller.signal }, { detector })
    expect(seenSignal).toBe(controller.signal)
  })

  it('folds an untyped detector throw into the unknown code', async () => {
    const boom: TempoDetector = {
      detect: async () => {
        throw new Error('tempo engine down')
      }
    }
    const result = await detectTempo({ audio }, { detector: boom })
    expect(result).toEqual({
      ok: false,
      code: 'unknown',
      detail: 'tempo engine down'
    })
  })

  it.each(['engine-unavailable', 'network', 'timeout', 'too-large'] as const)(
    'carries a typed %s TempoDetectionError code through',
    async (code) => {
      const boom: TempoDetector = {
        detect: async () => {
          throw new TempoDetectionError(code, `HTTP says ${code}`)
        }
      }
      const result = await detectTempo({ audio }, { detector: boom })
      expect(result).toEqual({ ok: false, code, detail: `HTTP says ${code}` })
    }
  )
})
