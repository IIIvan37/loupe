import { describe, expect, it } from 'vitest'
import { engraveChordSymbol, engraveNote } from './chord-engraving.ts'

describe('engraveNote', () => {
  // A `{key: …}` directive is free text: only a LEADING pitch engraves.
  it('leaves a mid-string flat untouched — prose is no pitch name', () => {
    expect(engraveNote('the Bb one')).toBe('the Bb one')
  })

  it('leaves a mid-string sharp untouched too', () => {
    expect(engraveNote('tune in F#')).toBe('tune in F#')
  })
})

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

  it('folds the min7b5 spelling to the same ø — one chord, one mark', () => {
    expect(engraveChordSymbol({ root: 'A', quality: 'min7b5' }).quality).toBe(
      'ø'
    )
  })

  it('folds the mi7b5 spelling to ø as well', () => {
    expect(engraveChordSymbol({ root: 'A', quality: 'mi7b5' }).quality).toBe(
      'ø'
    )
  })

  it('folds the capitalized Maj7 spelling to M7', () => {
    expect(engraveChordSymbol({ root: 'C', quality: 'Maj7' }).quality).toBe(
      'M7'
    )
  })

  it('folds the ma7 spelling to M7 — ma before a degree is major', () => {
    expect(engraveChordSymbol({ root: 'C', quality: 'ma7' }).quality).toBe('M7')
  })

  it('madd9 stays minor — ma before a letter is no major marker', () => {
    expect(engraveChordSymbol({ root: 'C', quality: 'madd9' }).quality).toBe(
      'madd9'
    )
  })

  it('folds minor-major: mmaj7 prints mM7', () => {
    expect(engraveChordSymbol({ root: 'C', quality: 'mmaj7' }).quality).toBe(
      'mM7'
    )
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
    // Exhaustive over the vocabulary table (not sampled): every root ×
    // quality × bass combination must be a fixpoint after one pass.
    const roots = ['C', 'C#', 'Db', 'F', 'B♭', 'G♯']
    const qualities = [
      '',
      'm7',
      'maj7',
      'Maj7',
      'ma7',
      'madd9',
      'mmaj7',
      'dim7',
      'aug',
      'm7b5',
      'min7b5',
      '7b9',
      '13#11',
      'sus4',
      'add9'
    ]
    const basses = [undefined, 'E', 'Ab', 'F#']
    const symbols = roots.flatMap((root) =>
      qualities.flatMap((quality) =>
        basses.map((bass) =>
          bass === undefined ? { root, quality } : { root, quality, bass }
        )
      )
    )
    const once = symbols.map(engraveChordSymbol)
    expect(once.map(engraveChordSymbol)).toEqual(once)
  })
})
