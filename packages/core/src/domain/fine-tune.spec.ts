import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { clampFineTuneCents } from './fine-tune.ts'

describe('clampFineTuneCents', () => {
  it('keeps an in-range integer untouched', () => {
    expect(clampFineTuneCents(30)).toBe(30)
  })

  it('clamps above the +50 ceiling', () => {
    expect(clampFineTuneCents(80)).toBe(50)
  })

  it('clamps below the −50 floor', () => {
    expect(clampFineTuneCents(-80)).toBe(-50)
  })

  it('reads NaN as no fine-tune at all', () => {
    expect(clampFineTuneCents(Number.NaN)).toBe(0)
  })

  it('reads a non-number (hand-edited manifest) as no fine-tune', () => {
    // `Number.isNaN` does not coerce: a string slips past it and Math.round
    // would return NaN to the transport — the documented « corruption reads
    // as 0 » contract must hold for non-numbers too.
    expect(clampFineTuneCents('x' as unknown as number)).toBe(0)
  })

  it('rounds to a whole cent', () => {
    expect(clampFineTuneCents(12.4)).toBe(12)
  })

  it('always lands on a whole cent within ±50', () => {
    fc.assert(
      fc.property(fc.double(), (cents) => {
        const clamped = clampFineTuneCents(cents)
        expect(
          Number.isInteger(clamped) && clamped >= -50 && clamped <= 50
        ).toBe(true)
      })
    )
  })
})
