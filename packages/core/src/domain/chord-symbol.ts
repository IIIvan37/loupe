/**
 * A single chord as it appears in a lead-sheet cell — `C`, `Am7`, `F#m7b5`,
 * `Cmaj7/E`. The root and slash bass are parsed as pitch names (so they can be
 * transposed), while the quality is preserved verbatim: the grid only needs to
 * render it back and never interprets it, so keeping it opaque makes the parse
 * lossless and the vocabulary open-ended.
 */
export interface ChordSymbol {
  readonly root: string
  readonly quality: string
  readonly bass?: string
}

/** ASCII accidentals plus the unicode glyphs pasted charts often carry. */
const ACCIDENTALS = new Set(['#', 'b', '♯', '♭'])

/** Peel a pitch name (letter + optional accidental) off the front of `text`. */
function splitRoot(text: string): { root: string; rest: string } {
  const second = text.charAt(1)
  const accidental = ACCIDENTALS.has(second) ? second : ''
  const root = (text[0] ?? '') + accidental
  return { root, rest: text.slice(root.length) }
}

export function formatChordSymbol(symbol: ChordSymbol): string {
  const head = symbol.root + symbol.quality
  return symbol.bass === undefined ? head : `${head}/${symbol.bass}`
}

/** The twelve pitch classes, spelled with sharps (the default output spelling). */
const PITCH_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B'
] as const

/** The twelve pitch classes spelled with flats — the alternate output spelling,
 *  chosen when the key uses flats (`F` → `Bb`, not `A#`). */
const FLAT_NAMES = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B'
] as const

/** Which accidental a spelling favours — the key's convention, not a note's. */
export type Accidental = 'sharp' | 'flat'

/** Spell a pitch class (0–11, wrapped) with the key's chosen accidental. */
export function spellPitchClass(
  pitchClass: number,
  accidental: Accidental
): string {
  const index = ((pitchClass % 12) + 12) % 12
  const table = accidental === 'flat' ? FLAT_NAMES : PITCH_NAMES
  return table[index] as string
}

const PITCH_CLASS: Readonly<Record<string, number>> = {
  C: 0,
  'C#': 1,
  'C♯': 1,
  Db: 1,
  'D♭': 1,
  D: 2,
  'D#': 3,
  'D♯': 3,
  Eb: 3,
  'E♭': 3,
  E: 4,
  F: 5,
  'F#': 6,
  'F♯': 6,
  Gb: 6,
  'G♭': 6,
  G: 7,
  'G#': 8,
  'G♯': 8,
  Ab: 8,
  'A♭': 8,
  A: 9,
  'A#': 10,
  'A♯': 10,
  Bb: 10,
  'B♭': 10,
  B: 11
}

/**
 * Move a single pitch name by `semitones`, spelling the result with sharps.
 * A whole-octave move (multiple of 12) keeps the original spelling untouched —
 * transposing by nothing must not re-spell `Db` as `C#`. Unknown names pass
 * through unchanged.
 */
function transposeNote(note: string, semitones: number): string {
  if (semitones % 12 === 0) return note
  const pitchClass = PITCH_CLASS[note]
  if (pitchClass === undefined) return note
  const index = (((pitchClass + semitones) % 12) + 12) % 12
  return PITCH_NAMES[index] as string
}

/** The pitch class (0–11) a note names, or undefined for an unknown name. */
export function pitchClassOf(note: string): number | undefined {
  return PITCH_CLASS[note]
}

/**
 * Re-spell a note under the key's accidental convention without moving it:
 * `A#` and `Bb` are the same pitch, but a flat key wants `Bb`. A whole
 * pitch class in — unknown names (or naturals, which spell the same either way)
 * pass through unchanged.
 */
export function respellNote(note: string, accidental: Accidental): string {
  const pitchClass = PITCH_CLASS[note]
  return pitchClass === undefined
    ? note
    : spellPitchClass(pitchClass, accidental)
}

/** Re-spell a chord's root and slash bass under the key's accidental. */
export function respellChordSymbol(
  symbol: ChordSymbol,
  accidental: Accidental
): ChordSymbol {
  const root = respellNote(symbol.root, accidental)
  return symbol.bass === undefined
    ? { ...symbol, root }
    : { ...symbol, root, bass: respellNote(symbol.bass, accidental) }
}

export function transposeChordSymbol(
  symbol: ChordSymbol,
  semitones: number
): ChordSymbol {
  const root = transposeNote(symbol.root, semitones)
  return symbol.bass === undefined
    ? { ...symbol, root }
    : { ...symbol, root, bass: transposeNote(symbol.bass, semitones) }
}

export function parseChordSymbol(text: string): ChordSymbol {
  const slash = text.indexOf('/')
  const head = slash === -1 ? text : text.slice(0, slash)
  const { root, rest: quality } = splitRoot(head)
  if (slash === -1) return { root, quality }
  return { root, quality, bass: splitRoot(text.slice(slash + 1)).root }
}
