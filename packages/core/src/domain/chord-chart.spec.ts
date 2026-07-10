import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { parseChart, transposeChartSource } from './chord-chart.ts'

describe('parseChart', () => {
  it('reads a single measure into one unlabelled section', () => {
    expect(parseChart('| C |')).toEqual({
      sections: [{ measures: [{ chords: [{ root: 'C', quality: '' }] }] }]
    })
  })

  it('splits a row into one measure per bar', () => {
    expect(parseChart('| C | Am |')).toEqual({
      sections: [
        {
          measures: [
            { chords: [{ root: 'C', quality: '' }] },
            { chords: [{ root: 'A', quality: 'm' }] }
          ]
        }
      ]
    })
  })

  it('reads space-separated chords within a bar', () => {
    expect(parseChart('| F G |')).toEqual({
      sections: [
        {
          measures: [
            {
              chords: [
                { root: 'F', quality: '' },
                { root: 'G', quality: '' }
              ]
            }
          ]
        }
      ]
    })
  })

  it('labels a section from a bracketed header', () => {
    expect(parseChart('[Verse]\n| C |')).toEqual({
      sections: [
        {
          label: 'Verse',
          measures: [{ chords: [{ root: 'C', quality: '' }] }]
        }
      ]
    })
  })

  it('reads runs of spaces as one separator — no phantom empty chord', () => {
    expect(parseChart('| C   G |')).toEqual({
      sections: [
        {
          measures: [
            {
              chords: [
                { root: 'C', quality: '' },
                { root: 'G', quality: '' }
              ]
            }
          ]
        }
      ]
    })
  })

  it('ignores blank lines before the first header — no empty section', () => {
    expect(parseChart('\n  \n[Intro]\n| C |').sections).toHaveLength(1)
  })

  it('reads an indented header line as a header', () => {
    expect(parseChart('  [Refrain]  \n| C |').sections[0]?.label).toBe(
      'Refrain'
    )
  })

  it('a header must own its whole line — trailing text makes a measure row', () => {
    expect(parseChart('[Intro] | C |').sections[0]?.label).toBeUndefined()
  })

  it('a bracket mid-line is not a header either', () => {
    expect(parseChart('| C | [Coda]').sections[0]?.label).toBeUndefined()
  })
})

describe('transposeChartSource', () => {
  it('transposes every chord in a row', () => {
    expect(transposeChartSource('| C | Am |', 2)).toBe('| D | Bm |')
  })

  it('transposes the slash bass with the chord', () => {
    expect(transposeChartSource('| Cmaj7/E |', 2)).toBe('| Dmaj7/F# |')
  })

  it('leaves section headers untouched', () => {
    expect(transposeChartSource('[Verse]\n| C |', 2)).toBe('[Verse]\n| D |')
  })

  it('preserves the layout — rows, blank lines, spacing', () => {
    expect(transposeChartSource('[A]\n| C   F |\n\n| G |', 1)).toBe(
      '[A]\n| C#   F# |\n\n| G# |'
    )
  })

  it('passes an unknown token through unchanged', () => {
    expect(transposeChartSource('| N.C. | C |', 2)).toBe('| N.C. | D |')
  })

  it('is the exact identity at zero semitones — flat spellings survive', () => {
    fc.assert(
      fc.property(fc.string(), (source) => {
        expect(transposeChartSource(source, 0)).toBe(source)
      })
    )
  })

  it('is the exact identity at a whole octave', () => {
    expect(transposeChartSource('[A]\n| Db | Bbm |', 12)).toBe(
      '[A]\n| Db | Bbm |'
    )
  })

  it('a whole octave preserves even malformed tokens verbatim', () => {
    expect(transposeChartSource('| C/E/G |', 12)).toBe('| C/E/G |')
  })

  it('a lossy token passes through verbatim at ANY interval', () => {
    // `C/E/G` cannot round-trip parse∘format (the second slash would drop) —
    // rewriting it would silently destroy part of the persisted source.
    expect(transposeChartSource('| C/E/G | C |', 1)).toBe('| C/E/G | C# |')
  })

  it('a fractional semitone count is refused — identity, never "undefined"', () => {
    expect(transposeChartSource('| C |', 0.5)).toBe('| C |')
  })

  it('NaN semitones are refused — identity, never "undefined"', () => {
    expect(transposeChartSource('| C |', Number.NaN)).toBe('| C |')
  })

  it('reads a unicode flat as its pitch class', () => {
    expect(transposeChartSource('| B♭ |', -1)).toBe('| A |')
  })

  it('reads a unicode sharp as its pitch class', () => {
    expect(transposeChartSource('| C♯m7 |', 1)).toBe('| Dm7 |')
  })

  it('an indented header keeps a chord-like label untouched', () => {
    expect(transposeChartSource('  [Solo A]\n| A |', 2)).toBe(
      '  [Solo A]\n| B |'
    )
  })

  it('up a fifth then down a fifth restores the pitch classes', () => {
    const source = '[Verse]\n| Db | Bbm7/F |'
    expect(transposeChartSource(transposeChartSource(source, 7), -7)).toBe(
      '[Verse]\n| C# | A#m7/F |'
    )
  })
})
