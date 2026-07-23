import {
  engraveChordSymbol,
  formatChordSymbol,
  type Key,
  parseChordSymbol,
  romanizeChordSymbol
} from '@app/core'
import { memo } from 'react'
import styles from './lead-sheet.module.css'

/** A pitch name the chart typography may decompose: letter + accidental. */
const PITCH = /^[A-G][#b♯♭]?$/

interface ChordGlyphProps {
  readonly text: string
  /** Set = read the letters as degrees of this key (AN.5) — display only,
      like the engraving; absent = print the letters. */
  readonly romanKey?: Key | undefined
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

/* memo: the sheet re-renders every playhead frame during playback while each
   glyph's (text, romanKey) stay identical — skip the per-chord re-parse. */
export const ChordGlyph = memo(function ChordGlyph({
  text,
  romanKey
}: ChordGlyphProps) {
  const parsed = parseChordSymbol(text)
  if (formatChordSymbol(parsed) !== text || !PITCH.test(parsed.root)) {
    return <span className={styles.glyph}>{text}</span>
  }
  // Engraving is display-only (Real Book glyphs); the source keeps its ASCII.
  // Romanizing rides the same rule — degrees first, then the quality glyphs.
  const roman = romanKey === undefined ? parsed : romanizeChordSymbol(parsed, romanKey)
  const engraved = engraveChordSymbol(roman)
  const minor = MINOR.exec(engraved.quality)?.[0] ?? ''
  const extension = engraved.quality.slice(minor.length)
  return (
    <span className={styles.glyph}>
      <span className={styles.glyphHead}>
        {engraved.root + minor}
        {extension !== '' && (
          <sup className={styles.glyphQuality}>{extension}</sup>
        )}
      </span>
      {engraved.bass !== undefined && (
        <span className={styles.glyphBass}>/{engraved.bass}</span>
      )}
    </span>
  )
})
