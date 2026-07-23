import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { spellPitchClass } from './chord-symbol.ts'
import { romanizeChordSymbol } from './roman-numeral.ts'

describe('romanizeChordSymbol', () => {
  it('reads the tonic as I', () => {
    const roman = romanizeChordSymbol(
      { root: 'C', quality: '' },
      { tonicPc: 0, mode: 'major' }
    )
    expect(roman.root).toBe('I')
  })

  it('reads the supertonic as II', () => {
    const roman = romanizeChordSymbol(
      { root: 'D', quality: 'm7' },
      { tonicPc: 0, mode: 'major' }
    )
    expect(roman.root).toBe('II')
  })

  it('reads an out-of-scale root as the flattened degree above', () => {
    const roman = romanizeChordSymbol(
      { root: 'Bb', quality: 'maj7' },
      { tonicPc: 0, mode: 'major' }
    )
    expect(roman.root).toBe('♭VII')
  })

  it('reads the slash bass as a degree too', () => {
    const roman = romanizeChordSymbol(
      { root: 'C', quality: '', bass: 'E' },
      { tonicPc: 0, mode: 'major' }
    )
    expect(roman.bass).toBe('III')
  })

  it('reads degrees from the named tonic, not from C', () => {
    const roman = romanizeChordSymbol(
      { root: 'Bb', quality: '7' },
      { tonicPc: 5, mode: 'major' }
    )
    expect(roman.root).toBe('IV')
  })

  it('reads a minor key from its tonic major scale (III in Am is ♭III)', () => {
    const roman = romanizeChordSymbol(
      { root: 'C', quality: 'maj7' },
      { tonicPc: 9, mode: 'minor' }
    )
    expect(roman.root).toBe('♭III')
  })

  it('keeps the quality verbatim — the numeral carries only the root', () => {
    const roman = romanizeChordSymbol(
      { root: 'D', quality: 'm7b5' },
      { tonicPc: 0, mode: 'major' }
    )
    expect(roman.quality).toBe('m7b5')
  })

  it('leaves a symbol whose root is no pitch name untouched', () => {
    const symbol = { root: 'N.C.', quality: '' }
    expect(romanizeChordSymbol(symbol, { tonicPc: 0, mode: 'major' })).toBe(
      symbol
    )
  })

  it('reads enharmonic spellings of one pitch class as one degree', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 11 }),
        fc.integer({ min: 0, max: 11 }),
        (rootPc, tonicPc) => {
          const key = { tonicPc, mode: 'major' as const }
          const sharp = romanizeChordSymbol(
            { root: spellPitchClass(rootPc, 'sharp'), quality: '' },
            key
          )
          const flat = romanizeChordSymbol(
            { root: spellPitchClass(rootPc, 'flat'), quality: '' },
            key
          )
          expect(sharp.root).toBe(flat.root)
        }
      )
    )
  })
})
