import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  clampPlaybackRate,
  MAX_PLAYBACK_RATE,
  MAX_TEMPO_PERCENT,
  MIN_PLAYBACK_RATE,
  MIN_TEMPO_PERCENT,
  stepTempoPercent,
  TEMPO_PERCENT_STEP
} from './playback-rate.ts'

describe('clampPlaybackRate', () => {
  it('passes a rate inside the range through unchanged', () => {
    expect(clampPlaybackRate(1)).toBe(1)
    expect(clampPlaybackRate(0.75)).toBe(0.75)
    // Fine transcription work sits below half speed (speed-trainer lot);
    // 40 % is the floor the ear validated — 25 % was too degraded.
    expect(clampPlaybackRate(0.4)).toBe(0.4)
  })

  it('clamps to the supported range', () => {
    expect(clampPlaybackRate(5)).toBe(MAX_PLAYBACK_RATE)
    expect(clampPlaybackRate(0.01)).toBe(MIN_PLAYBACK_RATE)
    expect(clampPlaybackRate(0.3)).toBe(MIN_PLAYBACK_RATE)
  })

  it('falls back to normal speed for NaN', () => {
    expect(clampPlaybackRate(Number.NaN)).toBe(1)
  })

  // Property: the result is always a usable rate within the range.
  it('always returns a rate within the range', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true }), (rate) => {
        const clamped = clampPlaybackRate(rate)
        expect(clamped).toBeGreaterThanOrEqual(MIN_PLAYBACK_RATE)
        expect(clamped).toBeLessThanOrEqual(MAX_PLAYBACK_RATE)
      })
    )
  })
})

describe('stepTempoPercent', () => {
  it('nudges the tempo one step in the given direction', () => {
    expect(stepTempoPercent(100, 1)).toBe(100 + TEMPO_PERCENT_STEP)
    expect(stepTempoPercent(100, -1)).toBe(100 - TEMPO_PERCENT_STEP)
  })

  it('rounds an off-integer read-out before stepping', () => {
    // The slider can leave a fractional percent; a keyboard step lands on a
    // whole number so the pill never shows `102.5 %`.
    expect(stepTempoPercent(99.6, 1)).toBe(100 + TEMPO_PERCENT_STEP)
  })

  it('clamps at the supported bounds — a step never leaves the range', () => {
    expect(stepTempoPercent(MAX_TEMPO_PERCENT, 1)).toBe(MAX_TEMPO_PERCENT)
    expect(stepTempoPercent(MIN_TEMPO_PERCENT, -1)).toBe(MIN_TEMPO_PERCENT)
    // A step that would overshoot lands exactly on the bound.
    expect(stepTempoPercent(MAX_TEMPO_PERCENT - 2, 1)).toBe(MAX_TEMPO_PERCENT)
  })

  it('always returns a percent within the range', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, min: -1000, max: 1000 }),
        fc.constantFrom(-1 as const, 1 as const),
        (percent, direction) => {
          const stepped = stepTempoPercent(percent, direction)
          expect(stepped).toBeGreaterThanOrEqual(MIN_TEMPO_PERCENT)
          expect(stepped).toBeLessThanOrEqual(MAX_TEMPO_PERCENT)
        }
      )
    )
  })
})
