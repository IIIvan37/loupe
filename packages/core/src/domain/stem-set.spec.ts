import { describe, expect, it } from 'vitest'
import { buildStemTrack } from './stem-set.ts'

describe('buildStemTrack', () => {
  it('keeps the stem identity and label', () => {
    const stem = buildStemTrack('bass', 'Basse', [[0, 1]], 4, 1)
    expect(stem.id).toBe('bass')
    expect(stem.label).toBe('Basse')
  })

  it('summarises the channels into a render-ready Track', () => {
    // 4 samples / 4 Hz = 1 second; one bucket over [0, 1, -1, 0.5].
    const stem = buildStemTrack('vox', 'Voix', [[0, 1, -1, 0.5]], 4, 1)
    expect(stem.track.durationSeconds).toBe(1)
    expect(stem.track.sampleRate).toBe(4)
    expect(stem.track.waveform.peaks).toEqual([{ min: -1, max: 1 }])
  })
})
