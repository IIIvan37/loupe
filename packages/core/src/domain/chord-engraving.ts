import type { ChordSymbol } from './chord-symbol.ts'
import { mapChordNotes } from './chord-symbol.ts'

/** The music glyphs ASCII accidentals print as. */
const FLAT = '♭'
const SHARP = '♯'

/**
 * The quality rules, in application order: the half-diminished fold must see
 * the ASCII degree before the accidental rules rewrite it. Each family of
 * spellings (m/mi/min, ma/maj/Maj) folds to one mark — same chord, one print.
 */
const QUALITY_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^m(?:in|i)?7[b♭]5$/, 'ø'],
  [/^[Mm]aj|^ma(?=\d|$)/, 'M'],
  [/(?<=^m(?:in|i)?)[Mm]aj(?=\d)/, 'M'],
  [/^dim/, '°'],
  [/^aug/, '+'],
  [/b(?=\d)/g, FLAT],
  [/#(?=\d)/g, SHARP]
]

/** A pitch name's ASCII accidental becomes its music glyph: `Bb`→`B♭`. */
export function engraveNote(note: string): string {
  return note
    .replace(/^([A-G])b/, `$1${FLAT}`)
    .replace(/^([A-G])#/, `$1${SHARP}`)
}

/**
 * Engrave a parsed chord for display, Real Book style. Display-only: the
 * chart source text is never rewritten — the consumer prints the engraved
 * parts and keeps editing the plain ASCII the user typed.
 */
export function engraveChordSymbol(symbol: ChordSymbol): ChordSymbol {
  const quality = QUALITY_RULES.reduce(
    (folded, [pattern, mark]) => folded.replace(pattern, mark),
    symbol.quality
  )
  return { ...mapChordNotes(symbol, engraveNote), quality }
}
