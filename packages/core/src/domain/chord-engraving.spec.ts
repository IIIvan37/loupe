import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { engraveChordSymbol } from './chord-engraving.ts'

describe('engraveChordSymbol', () => {
  it('prints maj7 as M7 — the Real Book major, no triangle', () => {
    expect(engraveChordSymbol({ root: 'C', quality: 'maj7' }).quality).toBe(
      'M7'
    )
  })

  it('prints maj9 as M9 — the maj prefix folds, the extension stays', () => {
    expect(engraveChordSymbol({ root: 'F', quality: 'maj9' }).quality).toBe(
      'M9'
    )
  })

  it('prints dim as the ° sign', () => {
    expect(engraveChordSymbol({ root: 'B', quality: 'dim' }).quality).toBe('°')
  })

  it('prints dim7 as °7 — the sign folds, the extension stays', () => {
    expect(engraveChordSymbol({ root: 'B', quality: 'dim7' }).quality).toBe(
      '°7'
    )
  })

  it('prints aug as the + sign', () => {
    expect(engraveChordSymbol({ root: 'C', quality: 'aug' }).quality).toBe('+')
  })

  it('prints half-diminished m7b5 as ø', () => {
    expect(engraveChordSymbol({ root: 'A', quality: 'm7b5' }).quality).toBe('ø')
  })

  it('prints a pasted unicode m7♭5 as ø too', () => {
    expect(engraveChordSymbol({ root: 'A', quality: 'm7♭5' }).quality).toBe('ø')
  })

  it('engraves a flat extension: 7b9 prints 7♭9', () => {
    expect(engraveChordSymbol({ root: 'C', quality: '7b9' }).quality).toBe(
      '7♭9'
    )
  })

  it('engraves a sharp extension: 13#11 prints 13♯11', () => {
    expect(engraveChordSymbol({ root: 'C', quality: '13#11' }).quality).toBe(
      '13♯11'
    )
  })

  it('a b not naming a degree is no accidental — sub stays sub', () => {
    // Only `b`/`#` immediately before a degree digit are accidentals.
    expect(engraveChordSymbol({ root: 'C', quality: 'sub' }).quality).toBe(
      'sub'
    )
  })

  it('leaves a quality with nothing to engrave untouched', () => {
    expect(engraveChordSymbol({ root: 'C', quality: 'sus4' }).quality).toBe(
      'sus4'
    )
  })

  it('engraves a flat root: Bb prints B♭', () => {
    expect(engraveChordSymbol({ root: 'Bb', quality: '7' }).root).toBe('B♭')
  })

  it('engraves a sharp root: C# prints C♯', () => {
    expect(engraveChordSymbol({ root: 'C#', quality: '' }).root).toBe('C♯')
  })

  it('engraves the slash bass accidental', () => {
    expect(
      engraveChordSymbol({ root: 'C', quality: '', bass: 'F#' }).bass
    ).toBe('F♯')
  })

  it('a chord without bass stays bass-less', () => {
    expect('bass' in engraveChordSymbol({ root: 'C', quality: 'maj7' })).toBe(
      false
    )
  })

  it('engraving is idempotent — printing a print changes nothing', () => {
    const symbols = fc.record(
      {
        root: fc.constantFrom('C', 'C#', 'Db', 'F', 'B♭', 'G♯'),
        quality: fc.constantFrom(
          '',
          'm7',
          'maj7',
          'maj9',
          'dim7',
          'aug',
          'm7b5',
          '7b9',
          '13#11',
          'sus4',
          'add9'
        ),
        bass: fc.constantFrom('E', 'Ab', 'F#')
      },
      { requiredKeys: ['root', 'quality'] }
    )
    fc.assert(
      fc.property(symbols, (symbol) => {
        const once = engraveChordSymbol(symbol)
        expect(engraveChordSymbol(once)).toEqual(once)
      })
    )
  })
})
