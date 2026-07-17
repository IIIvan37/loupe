import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  chartMatchesPitch,
  parseChart,
  renderChartSource,
  respellChartSource,
  transposeChart,
  transposeChartSource,
  unrollChart
} from './chord-chart.ts'

describe('parseChart', () => {
  it('reads a single measure into one unlabelled section', () => {
    expect(parseChart('| C |')).toEqual({
      directives: {},
      sections: [{ measures: [{ chords: [{ root: 'C', quality: '' }] }] }]
    })
  })

  it('splits a row into one measure per bar', () => {
    expect(parseChart('| C | Am |')).toEqual({
      directives: {},
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
      directives: {},
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
      directives: {},
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
      directives: {},
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

describe('parseChart — form grammar (P.2)', () => {
  it('flags the measure a |: opens as a repeat start', () => {
    expect(parseChart('|: C | G |').sections[0]?.measures[0]).toEqual({
      chords: [{ root: 'C', quality: '' }],
      repeatStart: true
    })
  })

  it('flags the measure a :| closes as a repeat end', () => {
    expect(parseChart('| C | G :|').sections[0]?.measures[1]).toEqual({
      chords: [{ root: 'G', quality: '' }],
      repeatEnd: true
    })
  })

  it('a one-measure repeat carries both flags', () => {
    expect(parseChart('|: C :|').sections[0]?.measures[0]).toEqual({
      chords: [{ root: 'C', quality: '' }],
      repeatStart: true,
      repeatEnd: true
    })
  })

  it('records the written position of a {d.c.} line', () => {
    expect(parseChart('| C | G |\n{d.c.}\n| F |').form).toEqual({ dc: 2 })
  })

  it('reads a trailing @ as a fermata on the measure', () => {
    expect(parseChart('| C@ |').sections[0]?.measures[0]).toEqual({
      chords: [{ root: 'C', quality: '' }],
      fermata: true
    })
  })

  it('a fermata on ANY chord of the bar flags the measure', () => {
    expect(parseChart('| C@ G |').sections[0]?.measures[0]?.fermata).toBe(true)
  })

  it('a lone : cell is a repeat bar around an empty measure, not a chord', () => {
    expect(parseChart('| : |').sections[0]?.measures[0]).toEqual({
      chords: [],
      repeatStart: true
    })
  })

  it('numbers a volta measure from its |1. bar', () => {
    expect(
      parseChart('|: C |1. G :|\n|2. F |').sections[0]?.measures[1]
    ).toEqual({
      chords: [{ root: 'G', quality: '' }],
      volta: 1,
      repeatEnd: true
    })
  })

  it('a volta spans its row until the closing repeat bar', () => {
    expect(parseChart('|: X |1. A | B :|').sections[0]?.measures[2]).toEqual({
      chords: [{ root: 'B', quality: '' }],
      volta: 1,
      repeatEnd: true
    })
  })

  it('the volta stops at its :| — later bars of the row are plain', () => {
    expect(
      parseChart('|1. A :| C |').sections[0]?.measures[1]?.volta
    ).toBeUndefined()
  })
})

describe('parseChart — head directives', () => {
  it('reads a {key: value} line at the head of the source', () => {
    expect(parseChart('{title: Your Song}\n| C |').directives).toEqual({
      title: 'Your Song'
    })
  })

  it('a directive line contributes no section and no measure', () => {
    const chart = parseChart('{style: pop ballad}\n[Intro]\n| C |')
    expect(chart.sections).toHaveLength(1)
    expect(chart.sections[0]?.measures).toHaveLength(1)
  })

  it('reads several directives, keys case-insensitive and trimmed', () => {
    const source = '{Title: Your Song}\n{ TEMPO : 128 }\n| C |'
    expect(parseChart(source).directives).toEqual({
      title: 'Your Song',
      tempo: '128'
    })
  })

  it('keeps colons inside the value — only the first one splits', () => {
    expect(parseChart('{title: Rock: The Musical}\n| C |').directives).toEqual({
      title: 'Rock: The Musical'
    })
  })

  it('a source without directives has an empty record', () => {
    expect(parseChart('| C |').directives).toEqual({})
  })

  it('blank lines between head directives are allowed', () => {
    const source = '{title: A}\n\n{artist: B}\n| C |'
    expect(parseChart(source).directives).toEqual({ title: 'A', artist: 'B' })
  })

  it('a {…} line after grid content starts is NOT a directive', () => {
    // The head is the only directive zone — P.2 will claim in-grid `{d.c.}`
    // lines for the form grammar, so they must not leak into overrides.
    const chart = parseChart('| C |\n{title: Late}')
    expect(chart.directives).toEqual({})
  })

  it('a directive after a section header is grid content, not an override', () => {
    expect(parseChart('[Intro]\n{title: Late}\n| C |').directives).toEqual({})
  })

  it('an indented directive line still reads as a directive', () => {
    expect(parseChart('  {key: Eb}  \n| C |').directives).toEqual({
      key: 'Eb'
    })
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

  it('transposes a fermata slash chord, keeping its @ suffix', () => {
    expect(transposeChartSource('| C/E@ |', 2)).toBe('| D/F#@ |')
  })

  it('keeps repeat bars and volta numbers verbatim, chords moving', () => {
    expect(transposeChartSource('|: C |1. G :|\n|2. F |', 2)).toBe(
      '|: D |1. A :|\n|2. G |'
    )
  })

  it('keeps a form-mark line verbatim', () => {
    expect(transposeChartSource('| C |\n{d.c.}', 2)).toBe('| D |\n{d.c.}')
  })

  it('transposes the {key: …} directive with the grid — the head must not lie', () => {
    expect(transposeChartSource('{key: C}\n| C |', 2)).toBe('{key: D}\n| D |')
  })

  it('the key directive name is case-insensitive and trimmed, like parsing', () => {
    expect(transposeChartSource('{ KEY : C}\n| C |', 2)).toBe(
      '{ KEY : D}\n| D |'
    )
  })

  it('reads a unicode flat in the {key: …} directive', () => {
    expect(transposeChartSource('{key: E♭}\n| C |', 1)).toBe('{key: E}\n| C# |')
  })

  it('a chord-like word in ANY other directive passes verbatim', () => {
    expect(transposeChartSource('{title: C major}\n| C |', 2)).toBe(
      '{title: C major}\n| D |'
    )
  })

  it('an indented non-key directive passes verbatim too', () => {
    expect(transposeChartSource('  {tempo: 128}\n| A |', 1)).toBe(
      '  {tempo: 128}\n| A# |'
    )
  })

  it('a non-key directive with trailing spaces still passes verbatim', () => {
    expect(transposeChartSource('{style: Cool Pop}  \n| C |', 2)).toBe(
      '{style: Cool Pop}  \n| D |'
    )
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

describe('respellChartSource', () => {
  it('rewrites sharps to flats under a flat key', () => {
    expect(respellChartSource('| A# | D# |', 'flat')).toBe('| Bb | Eb |')
  })

  it('rewrites flats to sharps under a sharp key', () => {
    expect(respellChartSource('| Db | Gb |', 'sharp')).toBe('| C# | F# |')
  })

  it('re-spells the slash bass and keeps the quality', () => {
    expect(respellChartSource('| Cmaj7/G# |', 'flat')).toBe('| Cmaj7/Ab |')
  })

  it('leaves naturals, headers and layout untouched', () => {
    expect(respellChartSource('[A]\n| C   F |\n\n| G |', 'flat')).toBe(
      '[A]\n| C   F |\n\n| G |'
    )
  })

  it('re-spells the {key} directive pitch too', () => {
    expect(respellChartSource('{key: A#}\n| A# |', 'flat')).toBe(
      '{key: Bb}\n| Bb |'
    )
  })

  it('leaves prose directives untouched', () => {
    expect(respellChartSource('{title: A# Blues}\n| A# |', 'flat')).toBe(
      '{title: A# Blues}\n| Bb |'
    )
  })

  it('passes an unknown token through unchanged', () => {
    expect(respellChartSource('| N.C. | A# |', 'flat')).toBe('| N.C. | Bb |')
  })
})

describe('transposeChart', () => {
  it('rewrites the text and accounts for the move together', () => {
    expect(
      transposeChart({ source: '| C | Am |', transposedBy: 0 }, 2)
    ).toEqual({ source: '| D | Bm |', transposedBy: 2 })
  })

  it('accumulates the offset across moves', () => {
    const once = transposeChart({ source: '| C |', transposedBy: 0 }, 1)
    const twice = transposeChart(once, -3)
    expect(twice).toEqual({ source: '| A# |', transposedBy: -2 })
  })

  it('a blank grid is a no-op — no invisible offset to corrupt a later grid', () => {
    const blank = { source: '', transposedBy: 0 }
    expect(transposeChart(blank, 1)).toBe(blank)
    const spaces = { source: '  \n ', transposedBy: 0 }
    expect(transposeChart(spaces, 1)).toBe(spaces)
  })

  it('a non-integer move is a no-op — the text would not move either', () => {
    const chart = { source: '| C |', transposedBy: 0 }
    expect(transposeChart(chart, 1.5)).toBe(chart)
    expect(transposeChart(chart, Number.NaN)).toBe(chart)
  })

  it('a whole-octave move keeps the text but still counts', () => {
    expect(transposeChart({ source: '| C |', transposedBy: 0 }, 12)).toEqual({
      source: '| C |',
      transposedBy: 12
    })
  })
})

describe('chartMatchesPitch', () => {
  it('matches when the grid was transposed exactly as the audio', () => {
    expect(chartMatchesPitch(0, 0)).toBe(true)
    expect(chartMatchesPitch(2, 2)).toBe(true)
    expect(chartMatchesPitch(-3, -3)).toBe(true)
  })

  it('diverges when the keys differ', () => {
    expect(chartMatchesPitch(0, 2)).toBe(false)
    expect(chartMatchesPitch(1, 0)).toBe(false)
    expect(chartMatchesPitch(-1, 1)).toBe(false)
  })

  it('an octave apart names the same chords — no divergence', () => {
    expect(chartMatchesPitch(0, 12)).toBe(true)
    expect(chartMatchesPitch(0, -12)).toBe(true)
    expect(chartMatchesPitch(2, 14)).toBe(true)
    expect(chartMatchesPitch(0, 14)).toBe(false)
  })
})

describe('parseChart — repeat count (xN)', () => {
  it('attaches a x3 cell to the preceding :| measure', () => {
    const chart = parseChart('| C | G :| x3')
    expect(chart.sections[0]?.measures[1]?.repeatCount).toBe(3)
  })

  it('the count cell adds no measure of its own', () => {
    const chart = parseChart('| C | G :| x3')
    expect(chart.sections[0]?.measures).toHaveLength(2)
  })

  it('reads the unicode × count token too', () => {
    const chart = parseChart('| C | G :| ×3')
    expect(chart.sections[0]?.measures[1]?.repeatCount).toBe(3)
  })

  it('an orphan count (no :| before it) stays a measure cell', () => {
    const chart = parseChart('| C | x3 |')
    expect(chart.sections[0]?.measures).toHaveLength(2)
  })

  it('a count after a volta bar stays a measure cell — counted voltas are not a thing', () => {
    const chart = parseChart('|1. G :| x3')
    expect(chart.sections[0]?.measures).toHaveLength(2)
  })

  it('a count cell on the next row does not reach back across the line', () => {
    const chart = parseChart('| C | G :|\n| x3 |')
    expect(chart.sections[0]?.measures[1]?.repeatCount).toBeUndefined()
  })
})

describe('unrollChart', () => {
  it('a |: … :| x3 plays three passes', () => {
    expect(unrollChart(parseChart('|: C | G :| x3'))).toEqual([
      0, 1, 0, 1, 0, 1
    ])
  })

  it('a :| x4 plays four passes', () => {
    expect(unrollChart(parseChart('| C :| x4'))).toEqual([0, 0, 0, 0])
  })

  it('an explicit x2 plays exactly like a bare :|', () => {
    expect(unrollChart(parseChart('| C :| x2'))).toEqual([0, 0])
  })

  it('unrolls a structureless chart to written order', () => {
    expect(unrollChart(parseChart('| C | G |'))).toEqual([0, 1])
  })

  it('plays a |: … :| repeat twice', () => {
    expect(unrollChart(parseChart('|: C | G :|'))).toEqual([0, 1, 0, 1])
  })

  it('a second bare :| repeats from after the first, not the top', () => {
    expect(unrollChart(parseChart('| C :|\n| G :|'))).toEqual([0, 0, 1, 1])
  })

  it('a |: mid-chart repeats from its own bar, not the top', () => {
    expect(unrollChart(parseChart('| A |\n|: B | C :|'))).toEqual([
      0, 1, 2, 1, 2
    ])
  })

  it('a fresh |: after a volta group opens at pass one again', () => {
    expect(unrollChart(parseChart('|: A |1. B :|\n|2. C |\n|: D :|'))).toEqual([
      0, 1, 0, 2, 3, 3
    ])
  })

  it('plays each volta on its own pass', () => {
    expect(unrollChart(parseChart('|: C |1. G :|\n|2. F |'))).toEqual([
      0, 1, 0, 2
    ])
  })

  it('a third volta earns a third pass', () => {
    expect(unrollChart(parseChart('|: C |1. D :|\n|2. E :|\n|3. F |'))).toEqual(
      [0, 1, 0, 2, 0, 3]
    )
  })

  it('guard — an orphan volta (no repeat) only plays its first ending', () => {
    expect(unrollChart(parseChart('| C |1. G |\n|2. F |'))).toEqual([0, 1])
  })

  it('a {d.c.} replays the chart from the top', () => {
    expect(unrollChart(parseChart('| C | G |\n{d.c.}'))).toEqual([0, 1, 0, 1])
  })

  it('with a {fine}, the replay stops there', () => {
    const source = '| C | G |\n{fine}\n| A |\n{d.c.}'
    expect(unrollChart(parseChart(source))).toEqual([0, 1, 2, 0, 1])
  })

  it('with a {coda}, the replay jumps there from the D.C. point', () => {
    const source = '| C | G |\n{d.c.}\n{coda}\n| F |'
    expect(unrollChart(parseChart(source))).toEqual([0, 1, 0, 1, 2])
  })

  it('the coda section never plays on the first pass', () => {
    const source = '| C |\n{d.c.}\n{coda}\n| F |'
    expect(unrollChart(parseChart(source)).slice(0, 1)).toEqual([0])
  })

  it('guard — a {coda} without a {d.c.} is ignored, written order plays', () => {
    expect(unrollChart(parseChart('| C |\n{coda}\n| G |'))).toEqual([0, 1])
  })

  it('guard — a {d.c.} before any measure is ignored, never an empty unroll', () => {
    expect(unrollChart(parseChart('{d.c.}\n| C |'))).toEqual([0])
  })

  it('a volta that also opens a repeat still plays on its pass', () => {
    expect(unrollChart(parseChart('|: A |1. B :|: 2. C | D |'))).toEqual([
      0, 1, 0, 2, 3
    ])
  })

  it('a two-bar first ending is skipped whole on the second pass', () => {
    expect(unrollChart(parseChart('|: X |1. A | B :|\n|2. C |'))).toEqual([
      0, 1, 2, 0, 3
    ])
  })

  it('a bare :| after a volta group repeats its own bar, not the group', () => {
    expect(unrollChart(parseChart('|: A |1. B :|\n|2. C |\n| D :|'))).toEqual([
      0, 1, 0, 2, 3, 3
    ])
  })

  it('measures written after a plain {d.c.} still play, after the replay', () => {
    expect(unrollChart(parseChart('| C |\n{d.c.}\n| G |'))).toEqual([0, 0, 1])
  })

  it('the D.C. replay honours repeats as written', () => {
    expect(unrollChart(parseChart('|: C | G :|\n{d.c.}'))).toEqual([
      0, 1, 0, 1, 0, 1, 0, 1
    ])
  })

  it('property — unrolling a structureless chart is the identity', () => {
    const label = fc.constantFrom('C', 'Am', 'F#m7b5', 'Bb/D', 'N.C.')
    fc.assert(
      fc.property(
        fc.array(label, { minLength: 1, maxLength: 32 }),
        fc.integer({ min: 1, max: 8 }),
        (labels, barsPerRow) => {
          const chart = parseChart(renderChartSource(labels, barsPerRow))
          return (
            JSON.stringify(unrollChart(chart)) ===
            JSON.stringify(labels.map((_, index) => index))
          )
        }
      )
    )
  })

  it('property — every unrolled index references a written measure', () => {
    const line = fc.constantFrom(
      '| C | G :|',
      '|: A | Bm |',
      '|1. F :|',
      '|2. E |',
      '|3. D :|',
      '{d.c.}',
      '{coda}',
      '{fine}',
      '[Verse]',
      '| G@ :|',
      '|: C :|'
    )
    fc.assert(
      fc.property(fc.array(line, { maxLength: 12 }), (lines) => {
        const chart = parseChart(lines.join('\n'))
        const written = chart.sections.flatMap((s) => s.measures).length
        return unrollChart(chart).every(
          (index) => Number.isInteger(index) && index >= 0 && index < written
        )
      })
    )
  })
})

describe('renderChartSource', () => {
  it('renders measures as bar-separated cells, wrapping rows', () => {
    expect(renderChartSource(['C', 'Am', 'F', 'G', 'C'], 4)).toBe(
      '| C | Am | F | G |\n| C |'
    )
  })

  it('prints a blank measure as N.C. so the bar count survives parsing', () => {
    expect(renderChartSource(['C', undefined, 'G'], 4)).toBe('| C | N.C. | G |')
  })

  it('prints a label the row grammar cannot hold as N.C.', () => {
    // An empty or bar-lined label would change the measure count under
    // parseChart, shifting every following bar off its downbeat.
    expect(renderChartSource(['', 'C|G'], 4)).toBe('| N.C. | N.C. |')
  })

  it('prints a two-chord cell verbatim — one measure, two chords', () => {
    expect(renderChartSource(['C G', 'Am'], 4)).toBe('| C G | Am |')
  })

  it('prints a multi-chord cell it cannot re-print exactly as N.C.', () => {
    // Irregular spacing would not round-trip through the row grammar.
    expect(renderChartSource(['C  G', ' C G'], 4)).toBe('| N.C. | N.C. |')
  })

  it('prints a structural label as N.C. — a bare : would open a repeat', () => {
    expect(renderChartSource([':', '1.'], 4)).toBe('| N.C. | N.C. |')
  })

  it('prints a cell holding ANY structural token as N.C.', () => {
    // A : or volta inside a multi-token cell would be read as a repeat bar
    // or an ending by parseCell, not as a chord.
    expect(renderChartSource(['C :', '1. C'], 4)).toBe('| N.C. | N.C. |')
  })

  it('prints a fermata-suffixed label as N.C. — @ would not round-trip', () => {
    expect(renderChartSource(['G@', 'C G@'], 4)).toBe('| N.C. | N.C. |')
  })

  it('renders nothing from no measures', () => {
    expect(renderChartSource([], 4)).toBe('')
  })

  it('clamps a degenerate row width to one bar per row', () => {
    expect(renderChartSource(['C', 'G'], 0)).toBe('| C |\n| G |')
  })

  it('round-trips: parsing the render yields one measure per label', () => {
    const label = fc.oneof(
      fc.constantFrom(
        'C',
        'Am',
        'F#m7b5',
        'Bb',
        'Cmaj7/E',
        'N.C.',
        'C G',
        'Am F G',
        undefined
      ),
      fc.string()
    )
    fc.assert(
      fc.property(
        fc.array(label, { minLength: 1, maxLength: 32 }),
        fc.integer({ min: 1, max: 12 }),
        (labels, barsPerRow) => {
          const chart = parseChart(renderChartSource(labels, barsPerRow))
          const measures = chart.sections.flatMap((section) => section.measures)
          return (
            measures.length === labels.length &&
            measures.every((measure) => measure.chords.length >= 1)
          )
        }
      )
    )
  })
})

describe('parseChart — meter changes ({time: N/M})', () => {
  it('records a mid-source {time} line at its written measure', () => {
    const chart = parseChart('| C | Am |\n{time: 2/4}\n| F |')
    expect(chart.meterChanges).toEqual([{ measure: 2, signature: '2/4' }])
  })

  it('a {time} line contributes no section and no measure', () => {
    const chart = parseChart('| C |\n{time: 2/4}\n| F |')
    expect(chart.sections).toHaveLength(1)
    expect(chart.sections[0]?.measures).toHaveLength(2)
  })

  it('a leading {time} is a head directive, not a change', () => {
    const chart = parseChart('{time: 4/4}\n| C |')
    expect(chart.directives).toEqual({ time: '4/4' })
    expect(chart.meterChanges).toBeUndefined()
  })

  it('reads several changes, each at its own measure', () => {
    const chart = parseChart(
      '| C | Am |\n{time: 2/4}\n| F |\n{time: 4/4}\n| G |'
    )
    expect(chart.meterChanges).toEqual([
      { measure: 2, signature: '2/4' },
      { measure: 3, signature: '4/4' }
    ])
  })

  it('normalizes spacing and reads the mark case-insensitively', () => {
    const chart = parseChart('| C |\n{ TIME :  6 / 8 }\n| F |')
    expect(chart.meterChanges).toEqual([{ measure: 1, signature: '6/8' }])
  })

  it('a malformed time value is grid content, never a change', () => {
    const chart = parseChart('| C |\n{time: fast}\n| F |')
    expect(chart.meterChanges).toBeUndefined()
  })

  it('a {time} change survives transposition verbatim', () => {
    expect(transposeChartSource('| C |\n{time: 2/4}\n| F |', 2)).toBe(
      '| D |\n{time: 2/4}\n| G |'
    )
  })

  it('a {time} change survives re-spelling verbatim', () => {
    expect(respellChartSource('| A# |\n{time: 2/4}\n| F |', 'flat')).toBe(
      '| Bb |\n{time: 2/4}\n| F |'
    )
  })
})
