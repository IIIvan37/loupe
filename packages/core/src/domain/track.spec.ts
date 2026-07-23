import { describe, expect, it } from 'vitest'
import { buildTrack } from './track.ts'

describe('buildTrack', () => {
  it('builds a track with rate, duration and waveform from one channel', () => {
    const track = buildTrack([[0, 1, -1, 0.5]], 4, 2)
    expect(track.sampleRate).toBe(4)
    expect(track.durationSeconds).toBe(1)
    expect(track.waveform.peaks).toEqual([
      { min: 0, max: 1, rms: Math.sqrt(0.5) },
      { min: -1, max: 0.5, rms: Math.sqrt(0.625) }
    ])
  })

  it('mixes multiple channels down to mono by averaging', () => {
    // Stereo: averaging [1, 0] with [-1, 1] → [0, 0.5].
    const track = buildTrack(
      [
        [1, 0],
        [-1, 1]
      ],
      2,
      2
    )
    expect(track.waveform.peaks).toEqual([
      { min: 0, max: 0, rms: 0 },
      { min: 0.5, max: 0.5, rms: 0.5 }
    ])
    // Two mono samples / 2 Hz = 1 s — guards the mixdown loop bounds.
    expect(track.durationSeconds).toBe(1)
  })

  it('rejects audio with no channels', () => {
    expect(() => buildTrack([], 44100, 8)).toThrow(/channel/)
  })

  it('rejects a non-positive sample rate', () => {
    expect(() => buildTrack([[0, 1]], 0, 2)).toThrow(/rate/)
  })
})
