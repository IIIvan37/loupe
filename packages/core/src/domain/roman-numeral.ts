import type { Key } from './chord-key.ts'
import { type ChordSymbol, pitchClassOf } from './chord-symbol.ts'

/** The major-scale intervals, numbered — the reference the degrees read from. */
const DEGREES = new Map<number, string>([
  [0, 'I'],
  [2, 'II'],
  [4, 'III'],
  [5, 'IV'],
  [7, 'V'],
  [9, 'VI'],
  [11, 'VII']
])

/**
 * Re-read a chord's letter names as degrees of `key` — `CM7` in C major
 * becomes `IM7`. Display-only, like the engraving: the chart source keeps
 * its letters, the consumer prints the romanized symbol.
 */
export function romanizeChordSymbol(
  symbol: ChordSymbol,
  key: Key
): ChordSymbol {
  const root = degreeOf(symbol.root, key)
  if (root === undefined) {
    return symbol
  }
  const bass =
    symbol.bass === undefined ? undefined : degreeOf(symbol.bass, key)
  return bass === undefined ? { ...symbol, root } : { ...symbol, root, bass }
}

/** A pitch name as a degree of `key`; no degree for no pitch name. */
function degreeOf(note: string, key: Key): string | undefined {
  const pc = pitchClassOf(note)
  if (pc === undefined) {
    return undefined
  }
  const interval = (((pc - key.tonicPc) % 12) + 12) % 12
  // Chromatic intervals all sit one semitone under a scale degree: the jazz
  // idiom reads them flat-side (`♭VII`, the tritone sub's `♭V`), never sharp.
  return DEGREES.get(interval) ?? `♭${DEGREES.get((interval + 1) % 12) ?? ''}`
}
