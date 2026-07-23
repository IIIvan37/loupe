import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  chartDiagnostics,
  chartMatchesPitch,
  measureSourceSpans,
  parseChart,
  parseFormRollout,
  renderChartSource,
  respellChartSource,
  transposeChart,
  transposeChartSource,
  unrollChart
} from './chord-chart.ts'
import { formatChordSymbol } from './chord-symbol.ts'

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

  it('keeps a repeat pass count verbatim, chords moving', () => {
    expect(transposeChartSource('| C | G :| x3', 2)).toBe('| D | A :| x3')
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

describe('parseFormRollout', () => {
  it('reads a 3x value as three passes', () => {
    expect(parseFormRollout('3x')).toBe(3)
  })

  it('reads the unicode × with a space', () => {
    expect(parseFormRollout('4 ×')).toBe(4)
  })

  it('prose is not a rollout', () => {
    expect(parseFormRollout('head in/out')).toBeUndefined()
  })

  it('a single pass is not a rollout — the form already plays once', () => {
    expect(parseFormRollout('1x')).toBeUndefined()
  })

  it('a missing directive is not a rollout', () => {
    expect(parseFormRollout(undefined)).toBeUndefined()
  })
})

describe('unrollChart — {form: Nx} rollout', () => {
  it('a {form: 3x} head plays the whole form three times', () => {
    expect(unrollChart(parseChart('{form: 3x}\n| C | G |'))).toEqual([
      0, 1, 0, 1, 0, 1
    ])
  })

  it('the rollout multiplies the form WITH its repeats', () => {
    expect(unrollChart(parseChart('{form: 2x}\n|: C :|'))).toEqual([0, 0, 0, 0])
  })

  it('a prose {form: …} value never changes playback', () => {
    expect(unrollChart(parseChart('{form: ad lib}\n| C |'))).toEqual([0])
  })

  it('property — {form: Nx} unrolls to exactly N concatenations', () => {
    const label = fc.constantFrom('C', 'Am', 'F#m7b5', 'Bb/D', 'N.C.')
    fc.assert(
      fc.property(
        fc.array(label, { minLength: 1, maxLength: 16 }),
        fc.integer({ min: 2, max: 5 }),
        (labels, count) => {
          const base = renderChartSource(labels, 4)
          const single = unrollChart(parseChart(base))
          const rolled = unrollChart(parseChart(`{form: ${count}x}\n${base}`))
          return (
            JSON.stringify(rolled) ===
            JSON.stringify(Array.from({ length: count }, () => single).flat())
          )
        }
      )
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

  it('prints a count-like label as N.C. — never fabricated structure', () => {
    // A detected 'x3' after a :| would read back as a pass count, silently
    // dropping a measure.
    expect(renderChartSource(['C', 'x3'], 4)).toBe('| C | N.C. |')
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

describe('measureSourceSpans', () => {
  it('maps each written measure to its token span in the source', () => {
    const source = '| C | G7 |\n| Am F |'
    expect(measureSourceSpans(source)).toEqual([
      { line: 0, start: 2, end: 3 },
      { line: 0, start: 6, end: 8 },
      { line: 1, start: 13, end: 17 }
    ])
    // The spans slice back to the exact cell text.
    const spans = measureSourceSpans(source)
    expect(spans.map((s) => source.slice(s.start, s.end))).toEqual([
      'C',
      'G7',
      'Am F'
    ])
  })

  it('skips non-grid lines exactly as the parser does', () => {
    const source = '{key: C}\n\n[A]\n| C |\n{d.c.}\n{time: 3/4}\n| G |'
    const spans = measureSourceSpans(source)
    expect(spans.map((s) => source.slice(s.start, s.end))).toEqual(['C', 'G'])
    expect(spans.map((s) => s.line)).toEqual([3, 6])
  })

  it('gives a repeat-count cell no span of its own (it merges into the bar)', () => {
    const source = '| C :| x3 |'
    const spans = measureSourceSpans(source)
    expect(spans).toHaveLength(1)
    expect(source.slice(spans[0]?.start, spans[0]?.end)).toBe('C :')
  })

  it('keeps an xN after a volta :| as its own measure span (the carry rule)', () => {
    // parseRow refuses to merge a count into a volta's :| — so must the map.
    const source = '|1. A :| x3 |'
    const spans = measureSourceSpans(source)
    expect(spans.map((s) => source.slice(s.start, s.end))).toEqual([
      '1. A :',
      'x3'
    ])
  })

  it('the volta carry STOPS at its :| — a later bare :| merges its xN again', () => {
    // A's :| closes the volta; B's :| is bare, so its x2 is a pass count.
    // A carry that never cleared would leak volta 1 onto B and keep the x2
    // as a phantom measure.
    const source = '|1. A :| B :| x2 |'
    const spans = measureSourceSpans(source)
    expect(spans.map((s) => source.slice(s.start, s.end))).toEqual([
      '1. A :',
      'B :'
    ])
  })

  it('an indented header still reads as a header — no phantom measure', () => {
    // The dispatch trims like the parser: without it, `  [A]` would tokenize
    // as a row and mint a span for a section label.
    const source = '  [A]\n| C |'
    expect(
      measureSourceSpans(source).map((s) => source.slice(s.start, s.end))
    ).toEqual(['C'])
  })

  it('the volta CARRIES across the row — an xN after a carried volta stays a measure', () => {
    // B has no volta of its own; it inherits 1 from the row. Without the
    // carry the x2 would merge into B's :| and a span would vanish.
    const source = '|1. A | B :| x2 |'
    const spans = measureSourceSpans(source)
    expect(spans.map((s) => source.slice(s.start, s.end))).toEqual([
      '1. A',
      'B :',
      'x2'
    ])
  })

  it('a braced line after grid content is a row, exactly as the parser reads it', () => {
    // After a header (and after a row), `{…}` lines are grid content — the
    // head-directive zone is closed. The map must count their measures too.
    const afterHeader = '[A]\n{x: y}\n| C |'
    expect(
      measureSourceSpans(afterHeader).map((s) =>
        afterHeader.slice(s.start, s.end)
      )
    ).toEqual(['{x: y}', 'C'])
    const afterRow = '| C |\n{t: v}'
    expect(
      measureSourceSpans(afterRow).map((s) => afterRow.slice(s.start, s.end))
    ).toEqual(['C', '{t: v}'])
  })

  it('the last cell of a row without a trailing bar still gets its span', () => {
    const source = '| C | G'
    expect(
      measureSourceSpans(source).map((s) => source.slice(s.start, s.end))
    ).toEqual(['C', 'G'])
  })

  it('measures offsets on the raw line, indentation included', () => {
    const source = '   | C |'
    expect(measureSourceSpans(source)).toEqual([{ line: 0, start: 5, end: 6 }])
  })

  it('property — one span per written measure, in order, re-parsing to the same chords', () => {
    const line = fc.constantFrom(
      '| C | G :|',
      '|: A | Bm |',
      '  | C :| x3 |',
      '|1. A :| x3 |',
      '|1. F :|',
      '|2. E |',
      '{d.c.}',
      '{coda}',
      '[Verse]',
      '{time: 3/4}',
      '| G@ :|',
      '|: C :|',
      ''
    )
    fc.assert(
      fc.property(fc.array(line, { maxLength: 12 }), (lines) => {
        const source = lines.join('\n')
        const chart = parseChart(source)
        const measures = chart.sections.flatMap((s) => s.measures)
        const spans = measureSourceSpans(source)
        expect(spans).toHaveLength(measures.length)
        let previousEnd = -1
        spans.forEach((span, index) => {
          // Spans never overlap and come back in written order.
          expect(span.start).toBeGreaterThan(previousEnd)
          previousEnd = span.end
          // The sliced cell re-parses to the same chords — the drift guard
          // between the mapping and the parser. Scoped to chord-shaped cells:
          // a cell whose slice reads as a head directive standalone (e.g.
          // `| {x: y} |`) would re-parse differently, so the corpus stays
          // clear of it.
          const slice = source.slice(span.start, span.end)
          const reparsed = parseChart(slice).sections.flatMap((s) => s.measures)
          expect(reparsed).toHaveLength(1)
          expect(reparsed[0]?.chords.map(formatChordSymbol)).toEqual(
            measures[index]?.chords.map(formatChordSymbol)
          )
        })
      })
    )
  })
})

describe('chartDiagnostics', () => {
  it('counts written measures per source line', () => {
    const d = chartDiagnostics('| C | G |\n| Am |')
    expect(d.measureCount).toBe(3)
    expect(d.measuresPerLine).toEqual(
      new Map([
        [0, 2],
        [1, 1]
      ])
    )
    expect(d.suspectTokens).toEqual([])
    expect(d.unreachableMeasures).toEqual([])
  })

  it('flags a token read as a chord that cannot be one', () => {
    // x3 without a bare :| before it is NOT a pass count — the parser reads
    // a chord with root « x ». The user deserves to know.
    const source = '| C | x3 |'
    const d = chartDiagnostics(source)
    expect(d.suspectTokens).toHaveLength(1)
    const suspect = d.suspectTokens[0]
    expect(suspect?.token).toBe('x3')
    expect(source.slice(suspect?.start, suspect?.end)).toBe('x3')
    expect(suspect?.line).toBe(0)
    // The second written measure holds the doubtful token.
    expect(suspect?.measure).toBe(1)
  })

  it('flags a slash chord the grammar cannot re-print', () => {
    // C/E/G round-trips to C/E — transposition would silently drop the G.
    expect(chartDiagnostics('| C/E/G |').suspectTokens).toHaveLength(1)
  })

  it('flags a slash bass that names no pitch — the root alone is not enough', () => {
    // F/x round-trips fine (parse is total), but « x » is no bass note:
    // transposition would move the F and pass the x through verbatim.
    expect(chartDiagnostics('| F/x |').suspectTokens).toHaveLength(1)
    expect(chartDiagnostics('| F/A |').suspectTokens).toEqual([])
  })

  it('carries the spans so one walk serves the locus and the diagnostics', () => {
    const source = '| C | G |'
    expect(chartDiagnostics(source).spans).toEqual(measureSourceSpans(source))
  })

  it('accepts real chords, N.C., fermatas and structural tokens', () => {
    // The x2 merges into the bare :| (a pass count, not a chord); the volta
    // bar and repeat dots are structure, not chords.
    const d = chartDiagnostics('|: Bb7@ | N.C. | F#m7b5 :| x2 |\n|1. F :|')
    expect(d.suspectTokens).toEqual([])
  })

  it('structure-only and multi-chord repeat cells never yield suspects', () => {
    // The trailing repeat dots of a multi-chord bar, a lone `:` cell (empty
    // repeated bar) and a bare volta bar are structure, not chords — none of
    // them may surface as « accord douteux ».
    expect(chartDiagnostics('| C G :|').suspectTokens).toEqual([])
    expect(chartDiagnostics('| : |').suspectTokens).toEqual([])
    expect(chartDiagnostics('|1. |').suspectTokens).toEqual([])
  })

  it('flags a swallowed mid-grid directive as the suspect measure it became', () => {
    // {x: y} after grid content is a ROW — two garbage chords shifting every
    // later downbeat. Both tokens read as suspects.
    const d = chartDiagnostics('| C |\n{x: y}')
    expect(d.measureCount).toBe(2)
    expect(d.suspectTokens.map((s) => s.token)).toEqual(['{x:', 'y}'])
  })

  it('lists the written measures the unrolled form never plays', () => {
    // A fine before the d.c. makes the tail dead; a volta above the pass
    // count is never taken.
    expect(
      chartDiagnostics('| C | G |\n{fine}\n{d.c.}\n| F |').unreachableMeasures
    ).toEqual([2])
    expect(
      chartDiagnostics('|: C |1. A :|\n|2. B |\n|3. D :|').unreachableMeasures
    ).toEqual([3])
  })

  it('property — diagnostics stay consistent with the parse and the spans', () => {
    const line = fc.constantFrom(
      '| C | G :|',
      '|: A | Bm |',
      '| x3 | hello |',
      '{d.c.}',
      '{fine}',
      '[Verse]',
      '|1. F :|',
      '|2. E |',
      '| N.C. |',
      ''
    )
    fc.assert(
      fc.property(fc.array(line, { maxLength: 10 }), (lines) => {
        const source = lines.join('\n')
        const d = chartDiagnostics(source)
        const spans = measureSourceSpans(source)
        // Same walk: the per-line counts sum to the span count.
        expect(d.measureCount).toBe(spans.length)
        let total = 0
        for (const [lineIndex, count] of d.measuresPerLine) {
          expect(count).toBeGreaterThan(0)
          expect(spans.filter((s) => s.line === lineIndex)).toHaveLength(count)
          total += count
        }
        expect(total).toBe(spans.length)
        // Every suspect slices back to its own token text.
        for (const suspect of d.suspectTokens) {
          expect(source.slice(suspect.start, suspect.end)).toBe(suspect.token)
        }
        // Unreachable ⊆ written, sorted, and disjoint from the unroll.
        const played = new Set(unrollChart(parseChart(source)))
        for (const index of d.unreachableMeasures) {
          expect(index).toBeGreaterThanOrEqual(0)
          expect(index).toBeLessThan(d.measureCount)
          expect(played.has(index)).toBe(false)
        }
      })
    )
  })
})

describe('transposeChart — key-aware respelling (AN.3)', () => {
  it('respells the transposed grid under the arrival key accidental', () => {
    // C +1 lands in Db (a flat key): the sharp spellings the transposer
    // emits are re-spelled flat, {key} included.
    const chart = transposeChart(
      { source: '{key: C}\n| C | Am | F | G |', transposedBy: 0 },
      1
    )
    expect(chart.source).toBe('{key: Db}\n| Db | Bbm | Gb | Ab |')
    expect(chart.transposedBy).toBe(1)
  })

  it('respells sharp when the arrival key is a sharp key', () => {
    // F -1 lands in E (4 sharps): flat spellings flip to sharps.
    const chart = transposeChart(
      { source: '{key: F}\n| Bb | F |', transposedBy: 0 },
      -1
    )
    expect(chart.source).toBe('{key: E}\n| A | E |')
  })

  it('a minor key decides with its own flat set', () => {
    // Am +1 → Bbm (flat minor): everything spells flat.
    const chart = transposeChart(
      { source: '{key: Am}\n| Am | E7 |', transposedBy: 0 },
      1
    )
    expect(chart.source).toBe('{key: Bbm}\n| Bbm | F7 |')
  })

  it('without a {key} directive the transposer keeps its sharp default', () => {
    const chart = transposeChart({ source: '| C |', transposedBy: 0 }, 1)
    expect(chart.source).toBe('| C# |')
  })

  it('a whole-octave move keeps the text verbatim — user spellings at rest survive', () => {
    // Bb7 is a bVII the user chose to spell flat in a sharp key: an octave
    // move (or none) must not normalise it away.
    const chart = transposeChart(
      { source: '{key: C}\n| C | Bb7 |', transposedBy: 0 },
      12
    )
    expect(chart.source).toBe('{key: C}\n| C | Bb7 |')
    expect(chart.transposedBy).toBe(12)
  })

  it('the octave guard also protects sharp spellings in a FLAT key', () => {
    // In Eb, a user's deliberate G# would be flattened by the respell — the
    // whole-octave skip is what keeps it: nothing moved, nothing re-spelled.
    const chart = transposeChart(
      { source: '{key: Eb}\n| Eb | G# |', transposedBy: 0 },
      12
    )
    expect(chart.source).toBe('{key: Eb}\n| Eb | G# |')
  })

  it('a sharp arrival key keeps the sharp spellings the transposer emits', () => {
    // D +2 lands in E (sharp): C#m must stay C#m — a flat respell here
    // would rewrite it Dbm, a name no E-major chart uses.
    const chart = transposeChart(
      { source: '{key: D}\n| D | Bm |', transposedBy: 0 },
      2
    )
    expect(chart.source).toBe('{key: E}\n| E | C#m |')
  })

  it('an unparseable {key} value leaves the move un-respelled', () => {
    const chart = transposeChart(
      { source: '{key: dorian vibes}\n| C |', transposedBy: 0 },
      1
    )
    expect(chart.source).toBe('{key: dorian vibes}\n| C# |')
  })
})
