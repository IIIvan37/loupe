import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  chartMeters,
  chartSectionAnchors,
  deduceStructure,
  relabelChartBySections,
  renderStructuredSource
} from './chart-structure.ts'
import { parseChart, renderChartSource, unrollChart } from './chord-chart.ts'
import { formatChordSymbol } from './chord-symbol.ts'
import type { DetectedSection } from './song-structure.ts'
import type { BeatGrid } from './tempo.ts'

/** A 4/4 grid: `bars` downbeats `barSeconds` apart, three off-beats each. */
function grid(bars: number, barSeconds: number): BeatGrid {
  const beats = []
  for (let bar = 0; bar < bars; bar++) {
    for (let beat = 0; beat < 4; beat++) {
      beats.push({
        timeSeconds: bar * barSeconds + (beat * barSeconds) / 4,
        downbeat: beat === 0
      })
    }
  }
  return beats
}

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

  it('prefers the larger section when two explanations cost the same', () => {
    const a = ['C', 'Am', 'F', 'G']
    const b = ['Dm', 'G7', 'C', 'E7']
    // [A A B] twice: the 12-bar tiling and the 4-bar tiling tie on cost.
    const song = [...a, ...a, ...b, ...a, ...a, ...b]
    expect(
      deduceStructure(song).map((section) => section.measures.length)
    ).toEqual([12, 12])
  })

  it('keeps the first occurrence bar on a split vote', () => {
    const verse = ['C', 'Am', 'F', 'G', 'Em', 'Am', 'Dm', 'G7']
    const noisy = ['C', 'Am', 'F', 'G', 'Em', 'A7', 'Dm', 'G7']
    const sections = deduceStructure([...verse, ...noisy])
    expect(sections.map((section) => section.measures)).toEqual([verse, verse])
  })

  it('still matches at exactly three quarters agreement', () => {
    const verse = ['C', 'Am', 'F', 'G', 'Em', 'Am', 'Dm', 'G7']
    const noisy = ['C', 'Am', 'F', 'G', 'Em', 'A7', 'Dm', 'E7']
    const sections = deduceStructure([...verse, ...noisy])
    expect(sections.map((section) => section.label)).toEqual(['A', 'A'])
  })

  it('never absorbs a shorter tail into a full section', () => {
    const sparse = [undefined, undefined, undefined, 'C']
    const tail = [undefined, undefined, undefined]
    const song = [...sparse, ...sparse, ...tail]
    expect(
      deduceStructure(song).map((section) => section.measures.length)
    ).toEqual([4, 4, 3])
  })

  it('treats a bar detected only in the earlier occurrence as disagreement', () => {
    const song = ['C', 'Am', 'F', 'G', 'C', 'Am', undefined, undefined]
    expect(
      deduceStructure(song).flatMap((section) => section.measures)
    ).toEqual(song)
  })

  it('treats a bar detected only in the later occurrence as disagreement', () => {
    const song = ['C', 'Am', undefined, undefined, 'C', 'Am', 'F', 'G']
    expect(
      deduceStructure(song).flatMap((section) => section.measures)
    ).toEqual(song)
  })

  it('never merges blocks that agree only on silence', () => {
    const song = [
      ...[undefined, undefined, undefined, 'C'],
      ...[undefined, undefined, undefined, 'G']
    ]
    expect(
      deduceStructure(song).flatMap((section) => section.measures)
    ).toEqual(song)
  })

  it('continues section labels past Z with two letters', () => {
    const blocks = Array.from({ length: 27 }, (_, index) => [
      `X${index}a`,
      `X${index}b`,
      `X${index}c`,
      `X${index}d`
    ])
    const song = blocks.flatMap((block) => [...block, ...block])
    const sections = deduceStructure(song)
    expect(sections[sections.length - 1]?.label).toBe('AA')
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

  it('does not fold same-label sections whose measures differ', () => {
    const first = { label: 'A', measures: ['C'] }
    const second = { label: 'A', measures: ['G'] }
    expect(renderStructuredSource([first, second], 4)).toBe(
      '[A]\n| C |\n\n[A]\n| G |'
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

describe('relabelChartBySections', () => {
  it('names each section header from the detected sections, keeping chords', () => {
    const source = '| C | Am | F | G |\n| C | Am | F | G |'
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 8, label: 'Couplet' },
      { startSeconds: 8, endSeconds: 16, label: 'Refrain' }
    ]
    expect(relabelChartBySections(source, sections, grid(8, 2), 4)).toBe(
      '[Couplet]\n| C | Am | F | G |\n\n[Refrain]\n| C | Am | F | G |'
    )
  })

  it('keeps each section its own chords — never votes across sections', () => {
    const source = '| C | Am | F | G |\n| C | Am | Dm | G |'
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 8, label: 'Couplet' },
      { startSeconds: 8, endSeconds: 16, label: 'Couplet' }
    ]
    expect(relabelChartBySections(source, sections, grid(8, 2), 4)).toBe(
      '[Couplet]\n| C | Am | F | G |\n\n[Couplet]\n| C | Am | Dm | G |'
    )
  })

  it('opens the first section at bar 0 even when it starts after a pickup', () => {
    // The first detected section starts at 4 s, but the two bars before it must
    // not be lost — the opening section always runs from the grid start.
    const source = '| C | Am | F | G |\n| C | Am | F | G |'
    const sections: DetectedSection[] = [
      { startSeconds: 4, endSeconds: 8, label: 'Couplet' },
      { startSeconds: 8, endSeconds: 16, label: 'Refrain' }
    ]
    expect(relabelChartBySections(source, sections, grid(8, 2), 4)).toBe(
      '[Couplet]\n| C | Am | F | G |\n\n[Refrain]\n| C | Am | F | G |'
    )
  })

  it('omits the header when the detection is one whole-song section', () => {
    const source = '| C | F | G | C |'
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 8, label: 'Intro' }
    ]
    expect(relabelChartBySections(source, sections, grid(4, 2), 4)).toBe(
      '| C | F | G | C |'
    )
  })

  it('unrolls a repeated grid so sections stay time-aligned', () => {
    const source = '|: C | Am | F | G :|'
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 8, label: 'Couplet' },
      { startSeconds: 8, endSeconds: 16, label: 'Refrain' }
    ]
    expect(relabelChartBySections(source, sections, grid(8, 2), 4)).toBe(
      '[Couplet]\n| C | Am | F | G |\n\n[Refrain]\n| C | Am | F | G |'
    )
  })

  it('collapses a multi-chord measure to its first chord (flat-token v1)', () => {
    const source = '| C G | Am | F | G |'
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 8, label: 'Intro' }
    ]
    expect(relabelChartBySections(source, sections, grid(4, 2), 4)).toBe(
      '| C | Am | F | G |'
    )
  })

  it('drops a section that maps past the grid, keeping what covers it', () => {
    const source = '| C | Am | F | G |'
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 8, label: 'Couplet' },
      { startSeconds: 8, endSeconds: 16, label: 'Refrain' }
    ]
    expect(relabelChartBySections(source, sections, grid(8, 2), 4)).toBe(
      '| C | Am | F | G |'
    )
  })

  it('returns a blank grid untouched — nothing to relabel', () => {
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 8, label: 'Couplet' }
    ]
    expect(relabelChartBySections('', sections, grid(8, 2), 4)).toBe('')
  })

  it('keeps a gridless chart as one block under the first section name', () => {
    const source = '| C | Am | F | G |'
    const flat: BeatGrid = []
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 8, label: 'Couplet' }
    ]
    expect(relabelChartBySections(source, sections, flat, 4)).toBe(
      '| C | Am | F | G |'
    )
  })

  it('never loses or invents a measure against the played grid', () => {
    // A flat grid of `bars` measures, cut into contiguous sections on interior
    // downbeats — the relabelled source must play back exactly those bars.
    const chord = fc.constantFrom('C', 'Am', 'F', 'G', 'Dm', 'Em')
    fc.assert(
      fc.property(
        fc.array(chord, { minLength: 1, maxLength: 16 }),
        fc.array(fc.integer({ min: 1, max: 15 }), { maxLength: 4 }),
        (chords, rawCuts) => {
          const bars = chords.length
          const source = renderChartSource(chords, 4)
          const barSeconds = 2
          const cuts = [...new Set(rawCuts.filter((cut) => cut < bars))].sort(
            (a, b) => a - b
          )
          const starts = [0, ...cuts]
          const sections: DetectedSection[] = starts.map((start, index) => ({
            startSeconds: start * barSeconds,
            endSeconds: (starts[index + 1] ?? bars) * barSeconds,
            label: `S${index}`
          }))
          const chart = parseChart(
            relabelChartBySections(source, sections, grid(bars, barSeconds), 4)
          )
          const measures = chart.sections.flatMap((section) => section.measures)
          const played = unrollChart(chart).map((index) => {
            const first = measures[index]?.chords[0]
            return first ? formatChordSymbol(first) : undefined
          })
          expect(played).toEqual(chords)
        }
      )
    )
  })
})

describe('chartSectionAnchors', () => {
  it('anchors each labelled section at the downbeat of its first measure', () => {
    const source = '[Couplet]\n| C | Am |\n[Refrain]\n| F | G |'
    expect(chartSectionAnchors(source, grid(4, 2))).toEqual([
      { timeSeconds: 0, label: 'Couplet' },
      { timeSeconds: 4, label: 'Refrain' }
    ])
  })

  it('skips an unlabelled leading block — no header, no marker', () => {
    const source = '| C | Am |\n[Refrain]\n| F | G |'
    expect(chartSectionAnchors(source, grid(4, 2))).toEqual([
      { timeSeconds: 4, label: 'Refrain' }
    ])
  })

  it('anchors in PLAYED measures — a repeat shifts the next section', () => {
    // [A] plays its two bars twice (|: :|), so [B] first plays at bar 4.
    const source = '[A]\n|: C | Am :|\n[B]\n| F | G |'
    expect(chartSectionAnchors(source, grid(8, 2))).toEqual([
      { timeSeconds: 0, label: 'A' },
      { timeSeconds: 8, label: 'B' }
    ])
  })

  it('skips a section the grid has no downbeat for', () => {
    const source = '[A]\n| C | Am |\n[B]\n| F | G |'
    expect(chartSectionAnchors(source, grid(2, 2))).toEqual([
      { timeSeconds: 0, label: 'A' }
    ])
  })

  it('skips an empty-labelled or measure-less header (mid-typing)', () => {
    const source = '[]\n| C |\n[Couplet]\n[Refrain]\n| F |'
    expect(chartSectionAnchors(source, grid(4, 2))).toEqual([
      { timeSeconds: 2, label: 'Refrain' }
    ])
  })

  it('ignores head directives when counting measures', () => {
    const source = '{key: F}\n[Couplet]\n| F | Bb |'
    expect(chartSectionAnchors(source, grid(4, 2))).toEqual([
      { timeSeconds: 0, label: 'Couplet' }
    ])
  })

  it('skips a section the form never plays (al Fine before it)', () => {
    // {fine} ends the replay before [B] is ever reached: B has a written
    // start but no played instant, so it anchors nothing.
    const source = '[A]\n| C | Am |\n{fine}\n{d.c.}\n[B]\n| F |'
    expect(chartSectionAnchors(source, grid(8, 2))).toEqual([
      { timeSeconds: 0, label: 'A' }
    ])
  })

  it('returns nothing without downbeats or without grid content', () => {
    expect(chartSectionAnchors('[A]\n| C |', [])).toEqual([])
    expect(chartSectionAnchors('', grid(4, 2))).toEqual([])
  })
})

/** A grid whose i-th measure holds `meters[i]` beats (beats every 0.5s). */
function meteredGrid(meters: readonly number[]): BeatGrid {
  const beats: { timeSeconds: number; downbeat: boolean }[] = []
  let time = 0
  for (const beatsInBar of meters) {
    for (let beat = 0; beat < beatsInBar; beat += 1) {
      beats.push({ timeSeconds: time, downbeat: beat === 0 })
      time += 0.5
    }
  }
  return beats
}

describe('chartMeters', () => {
  it('reads per-measure meters and their dominant from the grid', () => {
    expect(chartMeters(meteredGrid([4, 4, 2, 4]))).toEqual({
      meters: [4, 4, 2, 4],
      dominant: 4
    })
  })

  it('distrusts a final measure cut short of the dominant', () => {
    // The last downbeat interval runs to the track end: an odd count there is
    // truncation (a fade-out), not a signature change.
    expect(chartMeters(meteredGrid([4, 4, 2]))).toEqual({
      meters: [4, 4, undefined],
      dominant: 4
    })
  })
})

describe('renderStructuredSource — meter changes', () => {
  it('marks the measure whose meter leaves the running one, and the return', () => {
    const section = {
      label: 'A',
      measures: ['C', 'Am', 'F', 'G'],
      meters: [4, 4, 2, 4]
    }
    expect(renderStructuredSource([section], 4, 4)).toBe(
      '| C | Am |\n{time: 2/4}\n| F |\n{time: 4/4}\n| G |'
    )
  })

  it('writes no line on a steady meter', () => {
    const section = { label: 'A', measures: ['C', 'G'], meters: [4, 4] }
    expect(renderStructuredSource([section], 4, 4)).toBe('| C | G |')
  })

  it('an unknown meter inherits the running one', () => {
    const section = {
      label: 'A',
      measures: ['C', 'G'],
      meters: [4, undefined]
    }
    expect(renderStructuredSource([section], 4, 4)).toBe('| C | G |')
  })

  it('a change opening a repeated section lands before the repeat bars', () => {
    const section = { label: 'A', measures: ['C', 'G'], meters: [3, 3] }
    expect(renderStructuredSource([section, section], 4, 4)).toBe(
      '{time: 3/4}\n|: C | G :|'
    )
  })

  it('a change inside a repeated section stays inside the bars', () => {
    const section = {
      label: 'A',
      measures: ['C', 'F', 'G'],
      meters: [4, 2, 4]
    }
    expect(renderStructuredSource([section, section], 4, 4)).toBe(
      '|: C |\n{time: 2/4}\n| F |\n{time: 4/4}\n| G :|'
    )
  })

  it('re-opens each written copy at its own meter', () => {
    // A section ending off its opening meter: every later copy re-states it.
    const section = { label: 'A', measures: ['C', 'G'], meters: [4, 2] }
    expect(renderStructuredSource([section, section, section], 2, 4)).toBe(
      [
        '| C |',
        '{time: 2/4}',
        '| G |',
        '{time: 4/4}',
        '| C |',
        '{time: 2/4}',
        '| G |',
        '{time: 4/4}',
        '| C |',
        '{time: 2/4}',
        '| G |'
      ].join('\n')
    )
  })

  it('a change at a section boundary prints before its header', () => {
    const a = { label: 'A', measures: ['C', 'G'], meters: [4, 4] }
    const b = { label: 'B', measures: ['F'], meters: [3] }
    expect(renderStructuredSource([a, b], 4, 4)).toBe(
      '[A]\n| C | G |\n\n{time: 3/4}\n[B]\n| F |'
    )
  })
})

describe('deduceStructure — meters', () => {
  it('carries voted meters through a repeated block', () => {
    const labels = ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G']
    const meters = [4, 4, 2, 4, 4, 4, 2, 4]
    const [first] = deduceStructure(labels, meters)
    expect(first?.meters).toEqual([4, 4, 2, 4])
  })

  it('cleans a stray meter by majority vote across occurrences', () => {
    const block = ['C', 'Am', 'F', 'G']
    const labels = [...block, ...block, ...block]
    const meters = [4, 4, 4, 4, 4, 6, 4, 4, 4, 4, 4, 4]
    const [first] = deduceStructure(labels, meters)
    expect(first?.meters).toEqual([4, 4, 4, 4])
  })

  it('deduces without meters exactly as before', () => {
    const [first] = deduceStructure(['C', 'F', 'G', 'C'])
    expect(first?.meters).toBeUndefined()
  })
})

describe('relabelChartBySections — meter changes', () => {
  it('re-marks the grid meter changes on the relabelled chart', () => {
    const sections: readonly DetectedSection[] = [
      { label: 'verse', startSeconds: 0, endSeconds: 7 }
    ]
    expect(
      relabelChartBySections(
        '| C | Am | F | G |',
        sections,
        meteredGrid([4, 4, 2, 4]),
        4
      )
    ).toBe('| C | Am |\n{time: 2/4}\n| F |\n{time: 4/4}\n| G |')
  })
})
