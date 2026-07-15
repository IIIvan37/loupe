import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { BeatGrid } from './beat-grid.ts'
import { buildCountIn, synthesizeClickTrack } from './metronome.ts'

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

/** A steady grid: beats every `interval` from 0, downbeats every `bar`. */
function steadyGrid(
  count: number,
  interval: number,
  bar: number,
  phase = 0
): BeatGrid {
  return Array.from({ length: count }, (_, k) => ({
    timeSeconds: phase + k * interval,
    downbeat: k % bar === 0
  }))
}

describe('buildCountIn', () => {
  const grid = steadyGrid(16, 0.5, 4) // 120 BPM, 4/4, downbeats at 0/2/4…

  it('lands on the playhead when it already sits on a beat', () => {
    const countIn = buildCountIn({
      grid,
      bpm: 120,
      beatsPerBar: 4,
      playheadSeconds: 2,
      playbackRate: 1
    })
    expect(countIn?.startSeconds).toBe(2)
    // The counts only — the landing click is the track's own, at the start.
    expect(countIn?.beats).toEqual([
      { timeSeconds: 0, downbeat: true },
      { timeSeconds: 0.5, downbeat: false },
      { timeSeconds: 1, downbeat: false },
      { timeSeconds: 1.5, downbeat: false }
    ])
    expect(countIn?.durationSeconds).toBe(2)
  })

  it('snaps an off-beat playhead to the nearest grid beat', () => {
    const late = buildCountIn({
      grid,
      bpm: 120,
      beatsPerBar: 4,
      playheadSeconds: 2.3,
      playbackRate: 1
    })
    expect(late?.startSeconds).toBe(2.5)
    const early = buildCountIn({
      grid,
      bpm: 120,
      beatsPerBar: 4,
      playheadSeconds: 2.2,
      playbackRate: 1
    })
    expect(early?.startSeconds).toBe(2)
  })

  it('breaks a snap tie towards the earlier beat', () => {
    // 2.25 s sits exactly between the 2 s and 2.5 s beats.
    const countIn = buildCountIn({
      grid,
      bpm: 120,
      beatsPerBar: 4,
      playheadSeconds: 2.25,
      playbackRate: 1
    })
    expect(countIn?.startSeconds).toBe(2)
  })

  it('reads the bar phase from the downbeat behind, even on an irregular grid', () => {
    // Downbeats at beats 0 and 3 (an irregular detection): landing on index 5
    // sits two beats past its bar's one — accent the third count.
    const irregular: BeatGrid = [0, 0.5, 1, 1.5, 2, 2.5].map((t, k) => ({
      timeSeconds: t,
      downbeat: k === 0 || k === 3
    }))
    const countIn = buildCountIn({
      grid: irregular,
      bpm: 120,
      beatsPerBar: 4,
      playheadSeconds: 2.5,
      playbackRate: 1
    })
    expect(countIn?.beats.map((beat) => beat.downbeat)).toEqual([
      false,
      false,
      true,
      false
    ])
    // Landing on index 1: its « one » is the grid's very first beat — one
    // beat behind, so the accent falls on the last count.
    const nearStart = buildCountIn({
      grid: irregular,
      bpm: 120,
      beatsPerBar: 4,
      playheadSeconds: 0.5,
      playbackRate: 1
    })
    expect(nearStart?.beats.map((beat) => beat.downbeat)).toEqual([
      false,
      false,
      false,
      true
    ])
  })

  it('phases a pickup landing from the downbeat ahead', () => {
    // The landing sits before the first flagged downbeat (a pickup): count its
    // position backwards from the « one » two beats ahead.
    const pickup: BeatGrid = [0, 0.5, 1, 1.5, 2].map((t, k) => ({
      timeSeconds: t,
      downbeat: k === 2
    }))
    const countIn = buildCountIn({
      grid: pickup,
      bpm: 120,
      beatsPerBar: 4,
      playheadSeconds: 0,
      playbackRate: 1
    })
    expect(countIn?.beats.map((beat) => beat.downbeat)).toEqual([
      false,
      false,
      true,
      false
    ])
    // A three-beat pickup: the « one » ahead sits at an odd distance, so the
    // direction of the count matters (backwards from it, never forwards).
    const longPickup: BeatGrid = [0, 0.5, 1, 1.5, 2].map((t, k) => ({
      timeSeconds: t,
      downbeat: k === 3
    }))
    const fromStart = buildCountIn({
      grid: longPickup,
      bpm: 120,
      beatsPerBar: 4,
      playheadSeconds: 0,
      playbackRate: 1
    })
    expect(fromStart?.beats.map((beat) => beat.downbeat)).toEqual([
      false,
      false,
      false,
      true
    ])
  })

  it('phases the accents on the track bar — landing mid-bar is no « one »', () => {
    // Landing on 2.5 s = beat 2 of the bar starting at 2 s (0-indexed offset
    // 1): the musician hears « 2 3 4 1 » then starts on the 2 — the accent
    // falls where the track's one is, not on the first count.
    const countIn = buildCountIn({
      grid,
      bpm: 120,
      beatsPerBar: 4,
      playheadSeconds: 2.5,
      playbackRate: 1
    })
    expect(countIn?.beats.map((beat) => beat.downbeat)).toEqual([
      false,
      false,
      false,
      true
    ])
  })

  it('counts at the tempo felt at the landing, not the headline bpm', () => {
    // 120 BPM then 60 BPM from 8 s on — landing at 10 s counts at 60.
    const variable: BeatGrid = [
      ...steadyGrid(16, 0.5, 4),
      ...steadyGrid(8, 1, 4, 8)
    ]
    const countIn = buildCountIn({
      grid: variable,
      bpm: 120,
      beatsPerBar: 4,
      playheadSeconds: 10,
      playbackRate: 1
    })
    expect(countIn?.startSeconds).toBe(10)
    expect(countIn?.durationSeconds).toBeCloseTo(4, 5)
  })

  it('stretches with the playback rate — a slowed track gets a slowed count', () => {
    const countIn = buildCountIn({
      grid,
      bpm: 120,
      beatsPerBar: 4,
      playheadSeconds: 0,
      playbackRate: 0.5
    })
    expect(countIn?.beats[1]?.timeSeconds).toBe(1)
    expect(countIn?.durationSeconds).toBe(4)
  })

  it('counts from the playhead itself when the grid is empty', () => {
    const countIn = buildCountIn({
      grid: [],
      bpm: 120,
      beatsPerBar: 4,
      playheadSeconds: 1.234,
      playbackRate: 1
    })
    expect(countIn?.startSeconds).toBe(1.234)
    expect(countIn?.beats).toHaveLength(4)
    expect(countIn?.beats[0]?.downbeat).toBe(true)
  })

  it('is no count-in at all without a playable tempo or rate', () => {
    const base = {
      grid: [] as BeatGrid,
      beatsPerBar: 4,
      playheadSeconds: 0,
      playbackRate: 1
    }
    expect(buildCountIn({ ...base, bpm: Number.NaN })).toBeUndefined()
    expect(buildCountIn({ ...base, bpm: 0 })).toBeUndefined()
    expect(buildCountIn({ ...base, bpm: -120 })).toBeUndefined()
    expect(buildCountIn({ ...base, bpm: 120, playbackRate: 0 })).toBeUndefined()
    expect(
      buildCountIn({ ...base, bpm: 120, playbackRate: Number.NaN })
    ).toBeUndefined()
  })

  it('falls back to a one-beat bar on a degenerate meter', () => {
    const base = {
      grid: [] as BeatGrid,
      bpm: 120,
      playheadSeconds: 0,
      playbackRate: 1
    }
    expect(buildCountIn({ ...base, beatsPerBar: 0 })?.beats).toHaveLength(1)
    expect(
      buildCountIn({ ...base, beatsPerBar: Number.NaN })?.beats
    ).toHaveLength(1)
  })

  it('always lands on a grid beat with exactly one accented « one » per bar', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 20, max: 400, noNaN: true }),
        fc.integer({ min: 1, max: 12 }),
        fc.double({ min: 0.4, max: 2, noNaN: true }),
        fc.double({ min: 0, max: 10, noNaN: true }),
        (bpm, beatsPerBar, rate, playhead) => {
          const interval = 60 / bpm
          const trackGrid = steadyGrid(
            Math.ceil(10 / interval) + 1,
            interval,
            beatsPerBar
          )
          const countIn = buildCountIn({
            grid: trackGrid,
            bpm,
            beatsPerBar,
            playheadSeconds: playhead,
            playbackRate: rate
          })
          expect(countIn).toBeDefined()
          // The landing is a beat of the track's grid, the nearest one.
          const landing = trackGrid.find(
            (beat) => beat.timeSeconds === countIn?.startSeconds
          )
          expect(landing).toBeDefined()
          expect(
            Math.abs((countIn?.startSeconds ?? 0) - playhead)
          ).toBeLessThanOrEqual(interval / 2 + 1e-9)
          // One bar of counts (the landing click is the track's own), exactly
          // one « one » among them, and the whole bar heard before landing.
          expect(countIn?.beats).toHaveLength(beatsPerBar)
          expect(countIn?.beats.filter((beat) => beat.downbeat)).toHaveLength(1)
          const heard = 60 / (bpm * rate)
          expect(countIn?.durationSeconds).toBeCloseTo(beatsPerBar * heard, 8)
          const lastCount = countIn?.beats[countIn.beats.length - 1]
          expect(lastCount?.timeSeconds).toBeLessThan(
            countIn?.durationSeconds ?? Number.NaN
          )
        }
      )
    )
  })
})
