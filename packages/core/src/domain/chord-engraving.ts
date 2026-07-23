import type { ChordSymbol } from './chord-symbol.ts'

/**
 * Engrave a parsed chord for display, Real Book style. Display-only: the
 * chart source text is never rewritten — the consumer prints the engraved
 * parts and keeps editing the plain ASCII the user typed.
 */
/** A pitch name's ASCII accidental becomes its music glyph: `Bb`→`B♭`. */
function engraveNote(note: string): string {
  return note.replace(/^([A-G])b/, '$1♭').replace(/^([A-G])#/, '$1♯')
}

export function engraveChordSymbol(symbol: ChordSymbol): ChordSymbol {
  const quality = symbol.quality
    .replace(/^m7[b♭]5$/, 'ø')
    .replace(/^maj/, 'M')
    .replace(/^dim/, '°')
    .replace(/^aug/, '+')
    .replace(/b(?=\d)/g, '♭')
    .replace(/#(?=\d)/g, '♯')
  const root = engraveNote(symbol.root)
  return symbol.bass === undefined
    ? { ...symbol, root, quality }
    : { ...symbol, root, quality, bass: engraveNote(symbol.bass) }
}
