import type { Key } from './chord-key.ts'
import {
  type ChordSymbol,
  mapChordNotes,
  pitchClassOf
} from './chord-symbol.ts'

/**
 * Every interval from the tonic, as a degree of its MAJOR scale — the mode is
 * deliberately ignored (C in A minor reads ♭III, the jazz-chart reference).
 * Chromatic intervals all sit one semitone under a scale degree and read
 * flat-side (`♭VII`, the tritone sub's `♭V`), never sharp.
 */
const DEGREES = [
  'I',
  '♭II',
  'II',
  '♭III',
  'III',
  'IV',
  '♭V',
  'V',
  '♭VI',
  'VI',
  '♭VII',
  'VII'
] as const

/**
 * Re-read a chord's letter names as degrees of `key` — `CM7` in C major
 * becomes `IM7`. Display-only, like the engraving: the chart source keeps
 * its letters, the consumer prints the romanized symbol.
 */
export function romanizeChordSymbol(
  symbol: ChordSymbol,
  key: Key
): ChordSymbol {
  if (pitchClassOf(symbol.root) === undefined) {
    return symbol
  }
  // A bass naming no pitch keeps its letters — display must never drop it.
  return mapChordNotes(symbol, (note) => degreeOf(note, key) ?? note)
}

/** A pitch name as a degree of `key`; no degree for no pitch name. */
function degreeOf(note: string, key: Key): string | undefined {
  const pc = pitchClassOf(note)
  if (pc === undefined) {
    return undefined
  }
  return DEGREES[(((pc - key.tonicPc) % 12) + 12) % 12] as string
}
