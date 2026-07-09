import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  clampPlaybackRate,
  MAX_PLAYBACK_RATE,
  MIN_PLAYBACK_RATE
} from './playback-rate.ts'

describe('clampPlaybackRate', () => {
  it('passes a rate inside the range through unchanged', () => {
    expect(clampPlaybackRate(1)).toBe(1)
    expect(clampPlaybackRate(0.75)).toBe(0.75)
    // Fine transcription work sits well below half speed (speed-trainer lot).
    expect(clampPlaybackRate(0.25)).toBe(0.25)
  })

  it('clamps to the supported range', () => {
    expect(clampPlaybackRate(5)).toBe(MAX_PLAYBACK_RATE)
    expect(clampPlaybackRate(0.01)).toBe(MIN_PLAYBACK_RATE)
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
