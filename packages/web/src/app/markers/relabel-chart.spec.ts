import type { BeatGrid, DetectedSection } from '@app/core'
import { describe, expect, it } from 'vitest'
import { relabelChartFromSections } from './relabel-chart.ts'

/** A grid of `bars` measures, 2 beats each: downbeats at 0 s, 2 s, 4 s, … */
function grid(bars: number): BeatGrid {
  return Array.from({ length: bars * 2 }, (_, index) => ({
    timeSeconds: index,
    downbeat: index % 2 === 0
  }))
}

function section(
  startSeconds: number,
  endSeconds: number,
  label: string
): DetectedSection {
  return { startSeconds, endSeconds, label }
}

describe('relabelChartFromSections', () => {
  it('cuts the grid at the section starts and heads each block', () => {
    expect(
      relabelChartFromSections(
        '| C | Am |\n| F | G |',
        [section(0, 4, 'Couplet'), section(4, 8, 'Refrain')],
        grid(4),
        2
      )
    ).toBe('[Couplet]\n| C | Am |\n\n[Refrain]\n| F | G |')
  })

  it('keeps a lone section header — known structure must round-trip', () => {
    // The sections are the timeline's markers, not a deduction: suppressing
    // the only header would erase the last structure marker at the next
    // chart→marker sync.
    expect(
      relabelChartFromSections(
        '| C | Am |\n| F | G |',
        [section(0, 8, 'Refrain')],
        grid(4),
        2
      )
    ).toBe('[Refrain]\n| C | Am |\n| F | G |')
  })

  it('strips the headers when no section remains, keeping chords and head', () => {
    // Removing the last structure marker must not leave a stale header: the
    // chart→marker sync would resurrect the marker on the next text edit.
    expect(
      relabelChartFromSections(
        '{key: C}\n[Couplet]\n| C | Am |\n\n[Refrain]\n| F | G |',
        [],
        grid(4),
        2
      )
    ).toBe('{key: C}\n| C | Am |\n| F | G |')
  })

  it('returns a headerless chart untouched when no section remains', () => {
    // Nothing to strip — the user's own formatting is not rewritten.
    const source = '| C  |  Am |'
    expect(relabelChartFromSections(source, [], grid(2), 2)).toBe(source)
  })
})
