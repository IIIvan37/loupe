import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { BeatGrid } from './beat-grid.ts'
import { measureIndexAt } from './beat-grid.ts'
import {
  chartMeters,
  chartSectionAnchors,
  deduceStructure,
  measureSeekTime,
  relabelChartBySections,
  renderStructuredSource
} from './chart-structure.ts'
import { parseChart, renderChartSource, unrollChart } from './chord-chart.ts'
import { formatChordSymbol } from './chord-symbol.ts'
import { meteredGrid } from './metered-grid-fixture.ts'
import type { DetectedSection } from './song-structure.ts'

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

  it('still matches occurrences when jitter splits a bar in only one', () => {
    // The same verse, but detection split two bars mid-measure in the second
    // pass ('F G' vs 'F'): on exact cell equality that pass would fall below
    // the match ratio. Both passes agree on every downbeat chord, so they
    // must still group as one section — and the vote cleans the splits away.
    const verse = ['C', 'Am', 'F', 'G']
    const jittery = ['C', 'Am', 'F G', 'G C']
    const sections = deduceStructure([...verse, ...jittery, ...verse])
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

  it('keeps every chord of a multi-chord measure', () => {
    // A two-chord bar (hand-edited or a detection split) survives the
    // relabel verbatim — collapsing it to its first chord would destroy
    // the user's grid.
    const source = '| C G | Am | F | G |'
    const sections: DetectedSection[] = [
      { startSeconds: 0, endSeconds: 8, label: 'Intro' }
    ]
    expect(relabelChartBySections(source, sections, grid(4, 2), 4)).toBe(
      '| C G | Am | F | G |'
    )
  })

  it("drops an unprintable token but keeps the measure's real chords", () => {
    // A mid-cell token the row grammar reads structurally ('1.') cannot be
    // re-printed — the relabel keeps the printable chords rather than
    // wiping the whole bar to N.C.
    const source = '| C 1. | Am | F | G |'
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

describe('measureSeekTime', () => {
  it('seeks a written measure to the downbeat where it plays', () => {
    expect(measureSeekTime('| C | Am | F | G |', grid(4, 2), 1, 0)).toBe(2)
  })

  it('restarts the occurrence the playhead is inside (repeat pass)', () => {
    // |: C | Am :| unrolls [0, 1, 0, 1]; at 4.5 s the second pass of the
    // written measure 0 is playing — clicking it restarts THAT pass, no jump
    // back to the first one.
    expect(measureSeekTime('|: C | Am :|', grid(4, 2), 0, 4.5)).toBe(4)
  })

  it('treats a pass ending exactly on the playhead as behind (picks the next)', () => {
    // At 2 s the first pass of written 0 has just ended (half-open measures):
    // the click must go to the second pass at 4 s, not restart a passed one.
    expect(measureSeekTime('|: C | Am :|', grid(4, 2), 0, 2)).toBe(4)
  })

  it('wraps to the first occurrence once every pass is behind the playhead', () => {
    expect(measureSeekTime('| C | Am |', grid(2, 2), 0, 100)).toBe(0)
  })

  it('ignores an occurrence the grid has no downbeat for', () => {
    // The two-bar grid covers only the first pass of |: C | Am :|.
    expect(measureSeekTime('|: C | Am :|', grid(2, 2), 0, 100)).toBe(0)
  })

  it('answers nothing for a measure the form never plays', () => {
    expect(measureSeekTime('| C | Am |', grid(4, 2), 5, 0)).toBeUndefined()
  })

  it('answers nothing without a grid', () => {
    expect(measureSeekTime('| C | Am |', [], 0, 0)).toBeUndefined()
  })

  it('always seeks to a downbeat where the clicked measure is the one playing', () => {
    // Written ↔ played round-trip: whatever the playhead, the chosen instant
    // projects back (measureIndexAt → unroll) onto the clicked written index.
    const source = '|: C | Am :|\n| F | G |'
    const roundTripGrid = grid(6, 2)
    const played = unrollChart(parseChart(source))
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        fc.double({ min: 0, max: 20, noNaN: true }),
        (writtenIndex, playhead) => {
          const seek = measureSeekTime(
            source,
            roundTripGrid,
            writtenIndex,
            playhead
          )
          expect(
            played[measureIndexAt(roundTripGrid, seek as number) as number]
          ).toBe(writtenIndex)
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

  it('distrusts a short FIRST measure — a pickup, not a signature', () => {
    // Also what keeps the render from opening with a bare {time:} lead that
    // parseChart would swallow into the head-directive zone.
    expect(chartMeters(meteredGrid([2, 4, 4, 4]))).toEqual({
      meters: [undefined, 4, 4, 4],
      dominant: 4
    })
  })

  it('suppresses a RUN of off-dominant bars — a detector regime, not a signature', () => {
    // beat_this can read whole passages at half-bar downbeats (The Logical
    // Song's intro): consecutive short bars are that regime, never meter.
    expect(chartMeters(meteredGrid([4, 4, 4, 2, 2, 4, 4, 4])).meters).toEqual([
      4,
      4,
      4,
      undefined,
      undefined,
      4,
      4,
      4
    ])
  })

  it('keeps an isolated short bar — the genuine turnaround', () => {
    expect(chartMeters(meteredGrid([4, 4, 2, 4, 4])).meters).toEqual([
      4, 4, 2, 4, 4
    ])
  })

  it('suppresses an isolated LONG bar — a missed downbeat, not a signature', () => {
    expect(chartMeters(meteredGrid([4, 6, 4, 4])).meters).toEqual([
      4,
      undefined,
      4,
      4
    ])
  })

  it('rescales a folded grid to the felt beats-per-bar', () => {
    // An octave ×2 fold doubles every count; the session's meter is the
    // authority the chart prints, so the 2/4 bar survives as 2/4, not 4/8.
    expect(chartMeters(meteredGrid([8, 8, 4, 8], 0.25), 4)).toEqual({
      meters: [4, 4, 2, 4],
      dominant: 4
    })
  })

  it('drops a count the rescale cannot map to whole beats', () => {
    expect(chartMeters(meteredGrid([8, 8, 5, 8], 0.25), 4).meters).toEqual([
      4,
      4,
      undefined,
      4
    ])
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

  it('never folds a pair whose meter does not return by the repeat', () => {
    // Repeat bars cannot re-state a meter: pass two of |: … :| would be read
    // in the wrong signature, so the copies are written out instead.
    const section = { label: 'A', measures: ['C', 'G'], meters: [4, 2] }
    expect(renderStructuredSource([section, section], 2, 4)).toBe(
      [
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
