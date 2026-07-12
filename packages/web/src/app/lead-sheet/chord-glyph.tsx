import { formatChordSymbol, parseChordSymbol } from '@app/core'
import styles from './lead-sheet.module.css'

/** A pitch name the chart typography may decompose: letter + accidental. */
const PITCH = /^[A-G][#b♯♭]?$/

interface ChordGlyphProps {
  readonly text: string
}

/**
 * One chord in chart typography: the root large, the quality as a superscript,
 * the slash bass stacked under the head — the printed lead-sheet idiom. A token
 * the grammar cannot re-print exactly (parse∘format is not the identity, or the
 * root is no pitch name — `N.C.`) renders verbatim in one piece: decomposing it
 * would misprint what the user wrote. Same guard as transposition.
 */
/** The baseline part of a quality: a minor `m`/`mi`/`min` is part of the chord
    name (the mockup prints `Dm⁷` with the m full-size). Only the MAJOR
    spellings (`ma`, `ma7`, `maj…`) exclude it — `madd9` is still minor. */
const MINOR = /^m(?!aj)(?!a\d)(?!a$)[in]*/

export function ChordGlyph({ text }: ChordGlyphProps) {
  const parsed = parseChordSymbol(text)
  if (formatChordSymbol(parsed) !== text || !PITCH.test(parsed.root)) {
    return <span className={styles.glyph}>{text}</span>
  }
  const minor = MINOR.exec(parsed.quality)?.[0] ?? ''
  const extension = parsed.quality.slice(minor.length)
  return (
    <span className={styles.glyph}>
      <span className={styles.glyphHead}>
        {parsed.root + minor}
        {extension !== '' && (
          <sup className={styles.glyphQuality}>{extension}</sup>
        )}
      </span>
      {parsed.bass !== undefined && (
        <span className={styles.glyphBass}>/{parsed.bass}</span>
      )}
    </span>
  )
}
