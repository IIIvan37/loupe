import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { buildCountIn, synthesizeClickTrack } from './metronome.ts'
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

describe('buildCountIn', () => {
  it('lays one bar of beats at the given tempo, downbeat first', () => {
    const countIn = buildCountIn(120, 4)
    expect(countIn).toEqual({
      beats: [
        { timeSeconds: 0, downbeat: true },
        { timeSeconds: 0.5, downbeat: false },
        { timeSeconds: 1, downbeat: false },
        { timeSeconds: 1.5, downbeat: false }
      ],
      durationSeconds: 2
    })
  })

  it('counts the bar the meter says, not always four', () => {
    const countIn = buildCountIn(60, 3)
    expect(countIn?.beats.map((beat) => beat.timeSeconds)).toEqual([0, 1, 2])
    expect(countIn?.durationSeconds).toBe(3)
  })

  it('stretches with the playback rate — a slowed track gets a slowed count', () => {
    const countIn = buildCountIn(120, 4, 0.5)
    expect(countIn?.beats[1]?.timeSeconds).toBe(1)
    expect(countIn?.durationSeconds).toBe(4)
  })

  it('is no count-in at all without a playable tempo', () => {
    expect(buildCountIn(Number.NaN, 4)).toBeUndefined()
    expect(buildCountIn(0, 4)).toBeUndefined()
    expect(buildCountIn(-120, 4)).toBeUndefined()
  })

  it('is no count-in at all without a playable rate', () => {
    expect(buildCountIn(120, 4, 0)).toBeUndefined()
    expect(buildCountIn(120, 4, Number.NaN)).toBeUndefined()
  })

  it('falls back to a one-beat bar on a degenerate meter', () => {
    expect(buildCountIn(120, 0)?.beats).toHaveLength(1)
    expect(buildCountIn(120, Number.NaN)?.beats).toHaveLength(1)
  })

  it('always spans exactly one bar: n beats, duration = n intervals', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 20, max: 400, noNaN: true }),
        fc.integer({ min: 1, max: 12 }),
        fc.double({ min: 0.4, max: 2, noNaN: true }),
        (bpm, beatsPerBar, rate) => {
          const countIn = buildCountIn(bpm, beatsPerBar, rate)
          expect(countIn).toBeDefined()
          expect(countIn?.beats).toHaveLength(beatsPerBar)
          expect(countIn?.beats.filter((beat) => beat.downbeat)).toHaveLength(1)
          expect(countIn?.beats[0]?.downbeat).toBe(true)
          const interval = 60 / (bpm * rate)
          expect(countIn?.durationSeconds).toBeCloseTo(
            beatsPerBar * interval,
            10
          )
          const last = countIn?.beats[countIn.beats.length - 1]
          expect(last?.timeSeconds).toBeLessThan(
            countIn?.durationSeconds ?? Number.NaN
          )
        }
      )
    )
  })
})
