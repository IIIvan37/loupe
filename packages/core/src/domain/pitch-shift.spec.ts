import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  clampPitchSemitones,
  MAX_PITCH_SEMITONES,
  MIN_PITCH_SEMITONES,
  PITCH_SEMITONE_STEP,
  stepPitchSemitones
} from './pitch-shift.ts'

describe('clampPitchSemitones', () => {
  it('passes an in-range whole-semitone shift through unchanged', () => {
    expect(clampPitchSemitones(0)).toBe(0)
    expect(clampPitchSemitones(-5)).toBe(-5)
    expect(clampPitchSemitones(7)).toBe(7)
  })

  it('rounds to the nearest semitone', () => {
    expect(clampPitchSemitones(2.4)).toBe(2)
    expect(clampPitchSemitones(-2.6)).toBe(-3)
  })

  it('clamps to the supported range', () => {
    expect(clampPitchSemitones(40)).toBe(MAX_PITCH_SEMITONES)
    expect(clampPitchSemitones(-40)).toBe(MIN_PITCH_SEMITONES)
  })

  it('falls back to no shift for NaN', () => {
    expect(clampPitchSemitones(Number.NaN)).toBe(0)
  })

  // Property: always a whole number of semitones within the range.
  it('always returns an integer within the range', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true }), (semitones) => {
        const clamped = clampPitchSemitones(semitones)
        expect(Number.isInteger(clamped)).toBe(true)
        expect(clamped).toBeGreaterThanOrEqual(MIN_PITCH_SEMITONES)
        expect(clamped).toBeLessThanOrEqual(MAX_PITCH_SEMITONES)
      })
    )
  })
})

describe('stepPitchSemitones', () => {
  it('nudges the pitch one semitone in the given direction', () => {
    expect(stepPitchSemitones(0, 1)).toBe(PITCH_SEMITONE_STEP)
    expect(stepPitchSemitones(0, -1)).toBe(-PITCH_SEMITONE_STEP)
    expect(stepPitchSemitones(3, 1)).toBe(4)
  })

  it('clamps at the octave bounds — a step never leaves the range', () => {
    expect(stepPitchSemitones(MAX_PITCH_SEMITONES, 1)).toBe(MAX_PITCH_SEMITONES)
    expect(stepPitchSemitones(MIN_PITCH_SEMITONES, -1)).toBe(
      MIN_PITCH_SEMITONES
    )
  })

  it('always returns an integer within the range', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, min: -50, max: 50 }),
        fc.constantFrom(-1 as const, 1 as const),
        (semitones, direction) => {
          const stepped = stepPitchSemitones(semitones, direction)
          expect(Number.isInteger(stepped)).toBe(true)
          expect(stepped).toBeGreaterThanOrEqual(MIN_PITCH_SEMITONES)
          expect(stepped).toBeLessThanOrEqual(MAX_PITCH_SEMITONES)
        }
      )
    )
  })
})
