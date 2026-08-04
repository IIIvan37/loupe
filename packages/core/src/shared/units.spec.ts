import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  type Percent,
  percent,
  percentToRatio,
  pitchClass,
  pitchClassOfHz,
  type Ratio,
  ratio,
  ratioToPercent,
  type Seconds,
  seconds
} from './units.ts'

describe('the brand refuses a bare number', () => {
  // Compile-time pins: if a brand ever degrades to plain `number`, the
  // ts-expect-error directives below become errors and typecheck fails.
  it('constructors tag without changing the value', () => {
    // @ts-expect-error a bare number is not Seconds — parse it at the boundary
    const _bareSeconds: Seconds = 1.5
    // @ts-expect-error a bare number is not Percent
    const _barePercent: Percent = 100
    // @ts-expect-error a Percent is not a Ratio — convert, never assign
    const _crossUnit: Ratio = percent(100)
    expect(seconds(1.5)).toBe(1.5)
    expect(percent(100)).toBe(100)
    expect(ratio(1)).toBe(1)
  })
})

describe('pitchClass', () => {
  it('leaves the twelve classes where they are', () => {
    for (let pc = 0; pc < 12; pc++) {
      expect(pitchClass(pc)).toBe(pc)
    }
  })

  it('wraps octaves and negative intervals onto the same class', () => {
    expect(pitchClass(12)).toBe(0)
    expect(pitchClass(13)).toBe(1)
    expect(pitchClass(-1)).toBe(11)
    expect(pitchClass(-12)).toBe(0)
  })

  it('rounds a fractional semitone count to the nearest class first', () => {
    expect(pitchClass(11.6)).toBe(0)
    expect(pitchClass(-0.4)).toBe(0)
  })

  it('always lands on an integer class in 0…11', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), (n) => {
        const pc = pitchClass(n)
        expect(Number.isInteger(pc)).toBe(true)
        expect(pc).toBeGreaterThanOrEqual(0)
        expect(pc).toBeLessThan(12)
      })
    )
  })

  it('is octave-periodic', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), (n) => {
        expect(pitchClass(n + 12)).toBe(pitchClass(n))
      })
    )
  })
})

describe('pitchClassOfHz', () => {
  it('reads A440 as A and middle C as C', () => {
    expect(pitchClassOfHz(440)).toBe(9)
    expect(pitchClassOfHz(261.63)).toBe(0)
  })

  it('folds every octave of a pitch onto the same class', () => {
    fc.assert(
      fc.property(fc.double({ min: 32, max: 1050, noNaN: true }), (hz) => {
        expect(pitchClassOfHz(hz * 2)).toBe(pitchClassOfHz(hz))
      })
    )
  })
})

describe('percent ↔ ratio', () => {
  it('converts the tempo grain both ways', () => {
    expect(percentToRatio(percent(100))).toBe(1)
    expect(percentToRatio(percent(55))).toBe(0.55)
    expect(ratioToPercent(ratio(1.5))).toBe(150)
    expect(ratioToPercent(ratio(0.4))).toBe(40)
  })

  it('round-trips a percent to within float noise, not exactly', () => {
    // The /100 · *100 round-trip is NOT an IEEE754 identity (55 →
    // 55.00000000000001) — the bug that pushed speed-trainer to clamp
    // natively in percent space. The conversion home documents the noise
    // floor instead of pretending it away: stay within a billionth, and
    // read exact again after the display grain's rounding.
    fc.assert(
      fc.property(fc.double({ min: 40, max: 150, noNaN: true }), (n) => {
        const back = ratioToPercent(percentToRatio(percent(n)))
        expect(Math.abs(back - n)).toBeLessThan(1e-9)
        expect(Math.round(back)).toBe(Math.round(n))
      })
    )
  })
})
