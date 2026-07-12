import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { deduceStructure, renderStructuredSource } from './chart-structure.ts'
import { parseChart, unrollChart } from './chord-chart.ts'
import { formatChordSymbol } from './chord-symbol.ts'

describe('deduceStructure', () => {
  it('keeps an unrepeated grid as one section', () => {
    expect(deduceStructure(['C', 'F', 'G', 'C'])).toEqual([
      { label: 'A', measures: ['C', 'F', 'G', 'C'] }
    ])
  })

  it('splits an immediately repeated four-bar phrase into two sections', () => {
    expect(deduceStructure(['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'])).toEqual(
      [
        { label: 'A', measures: ['C', 'Am', 'F', 'G'] },
        { label: 'A', measures: ['C', 'Am', 'F', 'G'] }
      ]
    )
  })

  it('gives a different block its own next letter', () => {
    expect(
      deduceStructure([
        ...['C', 'Am', 'F', 'G'],
        ...['C', 'Am', 'F', 'G'],
        ...['F', 'G', 'Em', 'Am']
      ])
    ).toEqual([
      { label: 'A', measures: ['C', 'Am', 'F', 'G'] },
      { label: 'A', measures: ['C', 'Am', 'F', 'G'] },
      { label: 'B', measures: ['F', 'G', 'Em', 'Am'] }
    ])
  })

  it('matches a re-occurrence despite one mis-detected bar', () => {
    const verse = ['C', 'Am', 'F', 'G', 'Em', 'Am', 'Dm', 'G7']
    const noisy = ['C', 'Am', 'F', 'G', 'Em', 'A7', 'Dm', 'G7']
    const sections = deduceStructure([...verse, ...noisy])
    expect(sections.map((section) => section.label)).toEqual(['A', 'A'])
  })

  it('cleans a mis-detected bar by majority vote across occurrences', () => {
    const verse = ['C', 'Am', 'F', 'G', 'Em', 'Am', 'Dm', 'G7']
    const noisy = ['C', 'Am', 'F', 'G', 'Em', 'A7', 'Dm', 'G7']
    const sections = deduceStructure([...noisy, ...verse, ...verse])
    expect(sections.map((section) => section.measures)).toEqual([
      verse,
      verse,
      verse
    ])
  })
})

describe('renderStructuredSource', () => {
  it('renders a lone section flat, with no header', () => {
    expect(
      renderStructuredSource(
        [{ label: 'A', measures: ['C', 'F', 'G', 'C'] }],
        4
      )
    ).toBe('| C | F | G | C |')
  })

  it('folds an adjacent duplicate pair into repeat bars', () => {
    const phrase = { label: 'A', measures: ['C', 'Am', 'F', 'G'] }
    expect(renderStructuredSource([phrase, phrase], 4)).toBe(
      '|: C | Am | F | G :|'
    )
  })

  it('writes each distinct block under its letter header', () => {
    const a = { label: 'A', measures: ['C', 'Am', 'F', 'G'] }
    const b = { label: 'B', measures: ['F', 'G', 'Em', 'Am'] }
    expect(renderStructuredSource([a, a, b], 4)).toBe(
      '[A]\n|: C | Am | F | G :|\n\n[B]\n| F | G | Em | Am |'
    )
  })

  it('spans a folded pair across all of the section rows', () => {
    const verse = {
      label: 'A',
      measures: ['C', 'Am', 'F', 'G', 'Em', 'Am', 'Dm', 'G7']
    }
    expect(renderStructuredSource([verse, verse], 4)).toBe(
      '|: C | Am | F | G |\n| Em | Am | Dm | G7 :|'
    )
  })

  it('writes a run of three plays as plain copies', () => {
    const vamp = { label: 'A', measures: ['C', 'G'] }
    expect(renderStructuredSource([vamp, vamp, vamp], 2)).toBe(
      '| C | G |\n| C | G |\n| C | G |'
    )
  })
})

describe('structure round-trip', () => {
  /** Chord tokens whose parse∘format is the identity, plus a blank bar. */
  const vocabulary = ['C', 'Am', 'F', 'G7', 'Dm', 'E7', undefined]

  const bar = fc.constantFrom(...vocabulary)

  /** Structure-free noise AND structured songs (repeated blocks) — random
      noise alone almost never repeats, leaving folding paths unexercised. */
  const detectedLabels = fc.oneof(
    fc.array(bar, { minLength: 1, maxLength: 64 }),
    fc
      .tuple(
        fc.array(fc.array(bar, { minLength: 4, maxLength: 8 }), {
          minLength: 1,
          maxLength: 3
        }),
        fc.array(fc.nat(2), { minLength: 1, maxLength: 6 })
      )
      .map(([blocks, order]) =>
        order.flatMap((index) => blocks[index % blocks.length] as string[])
      )
  )

  it('plays back exactly the deduced sections, in order', () => {
    fc.assert(
      fc.property(detectedLabels, (labels) => {
        const sections = deduceStructure(labels)
        const chart = parseChart(renderStructuredSource(sections, 4))
        const written = chart.sections.flatMap((section) => section.measures)
        const played = unrollChart(chart).map((index) => {
          const chord = written[index]?.chords[0]
          return chord ? formatChordSymbol(chord) : undefined
        })
        const expected = sections
          .flatMap((section) => section.measures)
          .map((label) => label ?? 'N.C.')
        expect(played).toEqual(expected)
      })
    )
  })

  it('never loses or invents a measure against the detection', () => {
    fc.assert(
      fc.property(detectedLabels, (labels) => {
        const source = renderStructuredSource(deduceStructure(labels), 4)
        expect(unrollChart(parseChart(source))).toHaveLength(labels.length)
      })
    )
  })
})
