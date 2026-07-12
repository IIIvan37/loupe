import { describe, expect, it } from 'vitest'
import type { DetectedChordSpan } from '../domain/chord-detection.ts'
import type { BeatGrid } from '../domain/tempo.ts'
import { ChordDetectionError, detectChords } from './detect-chords.ts'
import type { ChordDetector, DecodedAudio } from './ports.ts'

const audio: DecodedAudio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }

/** A four-beat bar grid: downbeats every 2s, beats every 0.5s. */
function grid4(bars: number): BeatGrid {
  return Array.from({ length: bars * 4 }, (_, index) => ({
    timeSeconds: index * 0.5,
    downbeat: index % 4 === 0
  }))
}

/** Fake detector: returns fixed spans, recording the audio it was handed. */
function fakeDetector(
  spans: readonly DetectedChordSpan[]
): ChordDetector & { seen: DecodedAudio | undefined } {
  const state = { seen: undefined as DecodedAudio | undefined }
  return {
    async detect(given) {
      state.seen = given
      return spans
    },
    get seen() {
      return state.seen
    }
  }
}

describe('detectChords', () => {
  it('drafts one chord per measure as grid source rows', async () => {
    const spans: readonly DetectedChordSpan[] = [
      { startSeconds: 0, endSeconds: 2, label: 'C' },
      { startSeconds: 2, endSeconds: 4, label: 'Am' },
      { startSeconds: 4, endSeconds: 6, label: 'F' },
      { startSeconds: 6, endSeconds: 8, label: 'G' }
    ]
    const result = await detectChords(
      { audio, grid: grid4(4), barsPerRow: 4 },
      { detector: fakeDetector(spans) }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(result.source).toBe('| C | Am | F | G |')
  })

  it('wraps rows at four measures per row', async () => {
    const spans: readonly DetectedChordSpan[] = Array.from(
      { length: 5 },
      (_, index) => ({
        startSeconds: index * 2,
        endSeconds: index * 2 + 2,
        label: index % 2 === 0 ? 'C' : 'G'
      })
    )
    const result = await detectChords(
      { audio, grid: grid4(5), barsPerRow: 4 },
      { detector: fakeDetector(spans) }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(result.source).toBe('| C | G | C | G |\n| C |')
  })

  it('wraps the draft at the given bars-per-row', async () => {
    const spans: readonly DetectedChordSpan[] = [
      { startSeconds: 0, endSeconds: 2, label: 'C' },
      { startSeconds: 2, endSeconds: 4, label: 'Am' },
      { startSeconds: 4, endSeconds: 6, label: 'F' }
    ]
    const result = await detectChords(
      { audio, grid: grid4(3), barsPerRow: 2 },
      { detector: fakeDetector(spans) }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(result.source).toBe('| C | Am |\n| F |')
  })

  it('rejects a detection carrying non-finite times', async () => {
    const result = await detectChords(
      { audio, grid: grid4(2), barsPerRow: 4 },
      {
        detector: fakeDetector([
          // A clean span first: ONE corrupt span must poison the whole batch.
          { startSeconds: 0, endSeconds: 2, label: 'C' },
          { startSeconds: 2, endSeconds: Number.NaN, label: 'G' }
        ])
      }
    )
    expect(result).toEqual({
      ok: false,
      code: 'unknown',
      detail: 'invalid chord detection'
    })
  })

  it('hands the detector the same PCM it was given', async () => {
    const detector = fakeDetector([])
    await detectChords({ audio, grid: grid4(1), barsPerRow: 4 }, { detector })
    expect(detector.seen).toBe(audio)
  })

  it('rejects a grid without downbeats before calling the detector', async () => {
    const detector = fakeDetector([
      { startSeconds: 0, endSeconds: 2, label: 'C' }
    ])
    const result = await detectChords(
      { audio, grid: [{ timeSeconds: 0, downbeat: false }], barsPerRow: 4 },
      { detector }
    )
    expect(result).toEqual({
      ok: false,
      code: 'no-downbeat',
      detail: 'no downbeat to anchor measures on'
    })
    expect(detector.seen).toBeUndefined()
  })

  it('returns an error result when the detector reports nothing', async () => {
    const result = await detectChords(
      { audio, grid: grid4(2), barsPerRow: 4 },
      { detector: fakeDetector([]) }
    )
    expect(result).toEqual({
      ok: false,
      code: 'no-chords',
      detail: 'no chords detected'
    })
  })

  it('folds an untyped detector throw into the unknown code', async () => {
    const boom: ChordDetector = {
      detect: async () => {
        throw new Error('chord engine down')
      }
    }
    const result = await detectChords(
      { audio, grid: grid4(1), barsPerRow: 4 },
      { detector: boom }
    )
    expect(result).toEqual({
      ok: false,
      code: 'unknown',
      detail: 'chord engine down'
    })
  })

  it('carries the code of a typed ChordDetectionError through', async () => {
    const down: ChordDetector = {
      detect: async () => {
        throw new ChordDetectionError('engine-unavailable', 'HTTP 503')
      }
    }
    const result = await detectChords(
      { audio, grid: grid4(1), barsPerRow: 4 },
      { detector: down }
    )
    expect(result).toEqual({
      ok: false,
      code: 'engine-unavailable',
      detail: 'HTTP 503'
    })
  })

  it('carries a timeout ChordDetectionError code through', async () => {
    const slow: ChordDetector = {
      detect: async () => {
        throw new ChordDetectionError('timeout', 'HTTP 504')
      }
    }
    const result = await detectChords(
      { audio, grid: grid4(1), barsPerRow: 4 },
      { detector: slow }
    )
    expect(result).toEqual({ ok: false, code: 'timeout', detail: 'HTTP 504' })
  })

  it('carries a too-large ChordDetectionError code through', async () => {
    const heavy: ChordDetector = {
      detect: async () => {
        throw new ChordDetectionError('too-large', 'HTTP 413')
      }
    }
    const result = await detectChords(
      { audio, grid: grid4(1), barsPerRow: 4 },
      { detector: heavy }
    )
    expect(result).toEqual({ ok: false, code: 'too-large', detail: 'HTTP 413' })
  })

  it('carries a network ChordDetectionError code through', async () => {
    const offline: ChordDetector = {
      detect: async () => {
        throw new ChordDetectionError('network', 'Failed to fetch')
      }
    }
    const result = await detectChords(
      { audio, grid: grid4(1), barsPerRow: 4 },
      { detector: offline }
    )
    expect(result).toEqual({
      ok: false,
      code: 'network',
      detail: 'Failed to fetch'
    })
  })
})
