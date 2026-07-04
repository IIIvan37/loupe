import { describe, expect, it } from 'vitest'
import { synthesizeClickTrack } from './metronome.ts'
import type { BeatGrid } from './tempo.ts'

const sampleRate = 8000

/** Peak absolute sample amplitude over a window of frames. */
function peakAround(
  samples: Float32Array,
  centreSeconds: number,
  radiusFrames = 400
): number {
  const centre = Math.round(centreSeconds * sampleRate)
  let peak = 0
  for (let i = centre - radiusFrames; i <= centre + radiusFrames; i++) {
    const value = samples[i]
    if (value !== undefined) {
      peak = Math.max(peak, Math.abs(value))
    }
  }
  return peak
}

describe('synthesizeClickTrack', () => {
  it('spans the requested duration', () => {
    const samples = synthesizeClickTrack({
      beats: [],
      durationSeconds: 2,
      sampleRate
    })
    expect(samples.length).toBe(2 * sampleRate)
  })

  it('is silent with no beats', () => {
    const samples = synthesizeClickTrack({
      beats: [],
      durationSeconds: 1,
      sampleRate
    })
    expect(samples.every((value) => value === 0)).toBe(true)
  })

  it('places a click at a beat instant', () => {
    const beats: BeatGrid = [{ timeSeconds: 0.5, downbeat: false }]
    const samples = synthesizeClickTrack({
      beats,
      durationSeconds: 1,
      sampleRate
    })
    expect(peakAround(samples, 0.5)).toBeGreaterThan(0)
  })

  it('stays silent far from any beat', () => {
    const beats: BeatGrid = [{ timeSeconds: 0.5, downbeat: false }]
    const samples = synthesizeClickTrack({
      beats,
      durationSeconds: 2,
      sampleRate
    })
    expect(peakAround(samples, 1.5)).toBe(0)
  })

  it('accents a downbeat louder than a plain beat', () => {
    const beats: BeatGrid = [
      { timeSeconds: 0.25, downbeat: true },
      { timeSeconds: 0.75, downbeat: false }
    ]
    const samples = synthesizeClickTrack({
      beats,
      durationSeconds: 1,
      sampleRate
    })
    expect(peakAround(samples, 0.25)).toBeGreaterThan(peakAround(samples, 0.75))
  })

  it('never clips beyond the [-1, 1] range', () => {
    const beats: BeatGrid = [
      { timeSeconds: 0.1, downbeat: true },
      { timeSeconds: 0.1, downbeat: true }
    ]
    const samples = synthesizeClickTrack({
      beats,
      durationSeconds: 1,
      sampleRate
    })
    expect(samples.every((value) => value >= -1 && value <= 1)).toBe(true)
  })

  it('ignores a beat past the end of the track', () => {
    const beats: BeatGrid = [{ timeSeconds: 5, downbeat: true }]
    const samples = synthesizeClickTrack({
      beats,
      durationSeconds: 1,
      sampleRate
    })
    expect(samples.every((value) => value === 0)).toBe(true)
  })
})
