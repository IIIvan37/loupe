import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { formatTimecode } from './timecode.ts'

describe('formatTimecode', () => {
  it('formats whole minutes and seconds as m:ss', () => {
    expect(formatTimecode(0)).toBe('0:00')
    expect(formatTimecode(5)).toBe('0:05')
    expect(formatTimecode(65)).toBe('1:05')
    expect(formatTimecode(272)).toBe('4:32')
  })

  it('floors fractional seconds', () => {
    expect(formatTimecode(4.9)).toBe('0:04')
  })

  it('clamps negatives and NaN to zero', () => {
    expect(formatTimecode(-12)).toBe('0:00')
    expect(formatTimecode(Number.NaN)).toBe('0:00')
  })

  it('keeps counting minutes past an hour', () => {
    expect(formatTimecode(3661)).toBe('61:01')
  })

  // Property: always m:ss with a two-digit, in-range seconds field.
  it('always renders a valid m:ss timecode', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 100_000, noNaN: true }),
        (seconds) => {
          expect(formatTimecode(seconds)).toMatch(/^\d+:[0-5]\d$/)
        }
      )
    )
  })
})
