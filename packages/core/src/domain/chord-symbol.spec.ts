import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  formatChordSymbol,
  parseChordSymbol,
  transposeChordSymbol
} from './chord-symbol.ts'

/** A pitch name: a letter A–G with an optional single accidental. */
const pitchArb = fc
  .tuple(
    fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G'),
    fc.constantFrom('', '#', 'b')
  )
  .map(([letter, accidental]) => letter + accidental)

/** Realistic quality suffixes — none starts with an accidental or a slash. */
const qualityArb = fc.constantFrom(
  '',
  'm',
  '7',
  'maj7',
  'm7',
  'dim',
  'aug',
  'sus4',
  'm7b5',
  'add9'
)

/** A well-formed chord string: root + quality + optional slash bass. */
const chordTextArb = fc
  .tuple(pitchArb, qualityArb, fc.option(pitchArb, { nil: undefined }))
  .map(([root, quality, bass]) =>
    bass === undefined ? root + quality : `${root}${quality}/${bass}`
  )

describe('parseChordSymbol', () => {
  it('reads a bare major triad as its root with an empty quality', () => {
    expect(parseChordSymbol('C')).toEqual({ root: 'C', quality: '' })
  })

  it('splits the quality suffix from the root', () => {
    expect(parseChordSymbol('Am')).toEqual({ root: 'A', quality: 'm' })
  })

  it('keeps a sharp with the root', () => {
    expect(parseChordSymbol('F#')).toEqual({ root: 'F#', quality: '' })
  })

  it('keeps a flat with the root', () => {
    expect(parseChordSymbol('Bb7')).toEqual({ root: 'Bb', quality: '7' })
  })

  it('reads a slash bass as a separate note', () => {
    expect(parseChordSymbol('C/E')).toEqual({
      root: 'C',
      quality: '',
      bass: 'E'
    })
  })

  it('reads a slash bass after a quality suffix', () => {
    expect(parseChordSymbol('Cmaj7/E')).toEqual({
      root: 'C',
      quality: 'maj7',
      bass: 'E'
    })
  })
})

describe('formatChordSymbol', () => {
  it('prints a bare root', () => {
    expect(formatChordSymbol({ root: 'C', quality: '' })).toBe('C')
  })

  it('appends the quality suffix', () => {
    expect(formatChordSymbol({ root: 'A', quality: 'm' })).toBe('Am')
  })

  it('joins a slash bass with a slash', () => {
    expect(formatChordSymbol({ root: 'C', quality: 'maj7', bass: 'E' })).toBe(
      'Cmaj7/E'
    )
  })

  it('round-trips format ∘ parse for any well-formed symbol', () => {
    fc.assert(
      fc.property(chordTextArb, (text) => {
        expect(formatChordSymbol(parseChordSymbol(text))).toBe(text)
      })
    )
  })
})

describe('transposeChordSymbol', () => {
  it('raises the root by a number of semitones', () => {
    expect(transposeChordSymbol({ root: 'C', quality: '' }, 2)).toEqual({
      root: 'D',
      quality: ''
    })
  })

  it('spells a raised note with a sharp', () => {
    expect(transposeChordSymbol({ root: 'C', quality: '' }, 1)).toEqual({
      root: 'C#',
      quality: ''
    })
  })

  it('wraps around the octave', () => {
    expect(transposeChordSymbol({ root: 'A', quality: '' }, 3)).toEqual({
      root: 'C',
      quality: ''
    })
  })

  it('reads a flat root as its pitch class', () => {
    expect(transposeChordSymbol({ root: 'Db', quality: '' }, 2)).toEqual({
      root: 'D#',
      quality: ''
    })
  })

  it('transposes the slash bass too', () => {
    expect(
      transposeChordSymbol({ root: 'C', quality: '', bass: 'E' }, 2)
    ).toEqual({ root: 'D', quality: '', bass: 'F#' })
  })

  it('leaves the quality suffix untouched', () => {
    expect(transposeChordSymbol({ root: 'A', quality: 'm7' }, 2)).toEqual({
      root: 'B',
      quality: 'm7'
    })
  })

  it('is the identity when transposed by zero', () => {
    fc.assert(
      fc.property(chordTextArb, (text) => {
        const symbol = parseChordSymbol(text)
        expect(transposeChordSymbol(symbol, 0)).toEqual(symbol)
      })
    )
  })

  it('is the identity when transposed by a whole octave', () => {
    fc.assert(
      fc.property(chordTextArb, (text) => {
        const symbol = parseChordSymbol(text)
        expect(transposeChordSymbol(symbol, 12)).toEqual(symbol)
      })
    )
  })

  it('passes an unknown pitch name through unchanged', () => {
    expect(
      transposeChordSymbol({ root: 'H', quality: '', bass: 'X' }, 1)
    ).toEqual({ root: 'H', quality: '', bass: 'X' })
  })

  it('does not grow a bass key on a bass-less chord', () => {
    // Strict: `bass: undefined` and no `bass` key are different shapes under
    // exactOptionalPropertyTypes — the transposed chord must stay bass-less.
    expect(transposeChordSymbol({ root: 'C', quality: 'm' }, 1)).toStrictEqual({
      root: 'C#',
      quality: 'm'
    })
  })
})
