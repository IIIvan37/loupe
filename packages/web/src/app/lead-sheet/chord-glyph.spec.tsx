// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChordGlyph } from './chord-glyph.tsx'

describe('ChordGlyph', () => {
  it('still reads as the full chord symbol', () => {
    const { container } = render(<ChordGlyph text="Am7/G" />)
    expect(container).toHaveTextContent('Am7/G')
  })

  it('sets the quality as a superscript, engraved Real Book style', () => {
    // AN.4 decision: `maj7` prints `M7` — no triangle.
    const { container } = render(<ChordGlyph text="Fmaj7" />)
    expect(container.querySelector('sup')).toHaveTextContent('M7')
  })

  it('engraves the root accidental as a music glyph', () => {
    render(<ChordGlyph text="Bb7" />)
    expect(screen.getByText('B♭')).toBeInTheDocument()
  })

  it('engraves the extension accidental too', () => {
    const { container } = render(<ChordGlyph text="C7b9" />)
    expect(container.querySelector('sup')).toHaveTextContent('7♭9')
  })

  it('engraves the slash bass accidental', () => {
    render(<ChordGlyph text="C/F#" />)
    expect(screen.getByText('/F♯')).toBeInTheDocument()
  })

  it('prints half-diminished as ø', () => {
    const { container } = render(<ChordGlyph text="Am7b5" />)
    expect(container.querySelector('sup')).toHaveTextContent('ø')
  })

  it('the minor m stays at baseline — only the extension is superscript', () => {
    // The mockup prints `Dm⁷` with the m full-size: `m` is part of the chord
    // name, the extension is the annotation.
    render(<ChordGlyph text="Am7" />)
    expect(screen.getByText('Am')).toBeInTheDocument()
  })

  it('madd9 keeps its minor m at baseline — only maj spellings lose it', () => {
    render(<ChordGlyph text="Cmadd9" />)
    expect(screen.getByText('Cm')).toBeInTheDocument()
  })

  it('a plain triad has no superscript', () => {
    const { container } = render(<ChordGlyph text="C" />)
    expect(container.querySelector('sup')).toBeNull()
  })

  it('stacks the slash bass as its own part', () => {
    render(<ChordGlyph text="Am/G" />)
    expect(screen.getByText('/G')).toBeInTheDocument()
  })

  it('a token the grammar cannot re-print renders verbatim', () => {
    // Same guard as transposition: `C/E/G` does not round-trip parse∘format,
    // so decomposing it would silently misprint the token.
    // A single text node holds the whole token — decomposition would split it.
    render(<ChordGlyph text="C/E/G" />)
    expect(screen.getByText('C/E/G')).toBeInTheDocument()
  })

  it('N.C. is not a chord — no phantom « .C. » superscript', () => {
    const { container } = render(<ChordGlyph text="N.C." />)
    expect(container.querySelector('sup')).toBeNull()
  })
})
