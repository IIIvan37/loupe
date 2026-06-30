import { describe, expect, it } from 'vitest'
import type {
  DecodedAudio,
  SeparationProgress,
  StemSeparator
} from './ports.ts'
import { separateTrack } from './separate-track.ts'

const audio: DecodedAudio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }

/** Fake separator: emits the given progress events, then returns fixed stems. */
function fakeSeparator(events: SeparationProgress[] = []): StemSeparator {
  return {
    async separate(_audio, onProgress) {
      for (const event of events) {
        onProgress(event)
      }
      return [
        { id: 'vox', label: 'Voix', audio },
        { id: 'bass', label: 'Basse', audio }
      ]
    }
  }
}

describe('separateTrack — when the separator yields stems', () => {
  it('summarises each stem into a named, render-ready StemTrack', async () => {
    const result = await separateTrack(
      { audio, bucketCount: 1 },
      { separator: fakeSeparator() }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(result.stems.map((s) => [s.id, s.label])).toEqual([
      ['vox', 'Voix'],
      ['bass', 'Basse']
    ])
    expect(result.stems[0]?.track.waveform.peaks).toEqual([{ min: -1, max: 1 }])
  })

  it('retains the raw stem PCM as sources for playback/export', async () => {
    const result = await separateTrack(
      { audio, bucketCount: 1 },
      { separator: fakeSeparator() }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(result.sources.map((s) => s.id)).toEqual(['vox', 'bass'])
    expect(result.sources[0]?.audio).toBe(audio)
  })

  it('forwards every progress event to the optional sink', async () => {
    const events: SeparationProgress[] = [
      { phase: 'analysing', fraction: 0.5 },
      { phase: 'separating', fraction: 1 }
    ]
    const seen: SeparationProgress[] = []
    await separateTrack(
      { audio, bucketCount: 1 },
      { separator: fakeSeparator(events), onProgress: (p) => seen.push(p) }
    )
    expect(seen).toEqual(events)
  })
})

describe('separateTrack — adaptive detection', () => {
  it('annotates each stem with its detection verdict and masks silence', async () => {
    const loud: DecodedAudio = { sampleRate: 4, channels: [[1, -1, 1, -1]] }
    const silent: DecodedAudio = { sampleRate: 4, channels: [[0, 0, 0, 0]] }
    const separator: StemSeparator = {
      async separate() {
        return [
          { id: 'drums', label: 'Batterie', audio: loud },
          { id: 'bass', label: 'Basse', audio: silent }
        ]
      }
    }
    const result = await separateTrack({ audio, bucketCount: 1 }, { separator })
    if (!result.ok) throw new Error('expected ok')
    expect(result.stems[0]).toMatchObject({ confidence: 1, present: true })
    expect(result.stems[1]).toMatchObject({ confidence: 0, present: false })
  })
})

describe('separateTrack — when separation fails', () => {
  it('turns a thrown error into a typed error Result', async () => {
    const separator: StemSeparator = {
      separate: async () => {
        throw new Error('separator unavailable')
      }
    }
    const result = await separateTrack({ audio, bucketCount: 1 }, { separator })
    expect(result).toEqual({ ok: false, error: 'separator unavailable' })
  })

  it('stringifies a rejected non-Error value', async () => {
    const separator: StemSeparator = {
      separate: () => Promise.reject('boom')
    }
    const result = await separateTrack({ audio, bucketCount: 1 }, { separator })
    expect(result).toEqual({ ok: false, error: 'boom' })
  })
})
