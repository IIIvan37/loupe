import { describe, expect, it } from 'vitest'
import {
  chordLabelPerMeasure,
  type DetectedChordSpan
} from './chord-detection.ts'
import type { BeatGrid } from './tempo.ts'

/** A four-beat bar grid: downbeats every 2s, beats every 0.5s. */
function grid4(bars: number): BeatGrid {
  return Array.from({ length: bars * 4 }, (_, index) => ({
    timeSeconds: index * 0.5,
    downbeat: index % 4 === 0
  }))
}

function span(
  startSeconds: number,
  endSeconds: number,
  label?: string
): DetectedChordSpan {
  return { startSeconds, endSeconds, label }
}

describe('chordLabelPerMeasure', () => {
  it('assigns the span covering a measure to that measure', () => {
    const labels = chordLabelPerMeasure([span(0, 2, 'C')], grid4(1))
    expect(labels).toEqual(['C'])
  })

  it('gives each measure the label holding it longest', () => {
    // Bar 1: C for 1.5s vs G for 0.5s — C wins despite G crossing the bar line.
    const labels = chordLabelPerMeasure(
      [span(0, 1.5, 'C'), span(1.5, 4, 'G')],
      grid4(2)
    )
    expect(labels).toEqual(['C', 'G'])
  })

  it('constrains chord changes to downbeats even mid-span', () => {
    // One long span is re-cut on every downbeat interval it crosses.
    const labels = chordLabelPerMeasure([span(0, 8, 'F#m')], grid4(4))
    expect(labels).toEqual(['F#m', 'F#m', 'F#m', 'F#m'])
  })

  it('leaves a measure blank when silence outweighs every chord', () => {
    // Bar 2 is only covered 0.5s out of 2 — mostly silence.
    const labels = chordLabelPerMeasure(
      [span(0, 2, 'C'), span(2, 2.5, 'G')],
      grid4(2)
    )
    expect(labels).toEqual(['C', undefined])
  })

  it('treats an unlabelled span as silence', () => {
    const labels = chordLabelPerMeasure(
      [span(0, 2, 'C'), span(2, 4, undefined)],
      grid4(2)
    )
    expect(labels).toEqual(['C', undefined])
  })

  it('gives the last downbeat a bar as long as the previous one', () => {
    // The final downbeat opens one musical bar (the previous gap), so the
    // detection filling [2, 4) lands in it.
    const grid: BeatGrid = [
      { timeSeconds: 0, downbeat: true },
      { timeSeconds: 2, downbeat: true }
    ]
    const labels = chordLabelPerMeasure(
      [span(0, 2, 'C'), span(2, 4, 'G')],
      grid
    )
    expect(labels).toEqual(['C', 'G'])
  })

  it('ignores detection past the end of the last bar', () => {
    // The grid is the structural truth: harmony detected beyond it (a
    // truncated grid) must not stretch or relabel the final bar.
    const grid: BeatGrid = [
      { timeSeconds: 0, downbeat: true },
      { timeSeconds: 2, downbeat: true }
    ]
    const labels = chordLabelPerMeasure(
      [span(0, 2, 'C'), span(6, 8, 'G')],
      grid
    )
    expect(labels).toEqual(['C', undefined])
  })

  it('yields nothing when the detection never reaches the first downbeat', () => {
    const grid: BeatGrid = [
      { timeSeconds: 1, downbeat: true },
      { timeSeconds: 3, downbeat: true }
    ]
    // Ending exactly ON the first downbeat leaves every bar empty too.
    expect(chordLabelPerMeasure([span(0, 1, 'C')], grid)).toEqual([])
  })

  it('lets a chord win a bar it holds exactly half of', () => {
    // Ties go to the chord, not silence: half a bar of C is a C bar.
    const labels = chordLabelPerMeasure([span(0, 1, 'C')], grid4(2))
    expect(labels).toEqual(['C', undefined])
  })

  it('breaks a tie between chords toward the earlier one', () => {
    // Both chords alternate WITHIN each half — no clean two-chord bar, so the
    // cell falls back to the whole-bar vote, where the earlier chord wins ties.
    const labels = chordLabelPerMeasure(
      [
        span(0, 0.5, 'C'),
        span(0.5, 1, 'G'),
        span(1, 1.5, 'C'),
        span(1.5, 2, 'G')
      ],
      grid4(1)
    )
    expect(labels).toEqual(['C'])
  })

  it('splits a bar whose halves hold different chords into a two-chord cell', () => {
    const labels = chordLabelPerMeasure(
      [span(0, 1, 'C'), span(1, 2, 'G')],
      grid4(1)
    )
    expect(labels).toEqual(['C G'])
  })

  it('keeps one chord when a passing chord never dominates a half', () => {
    // G only holds the last 0.3s — jitter, not a mid-bar change.
    const labels = chordLabelPerMeasure(
      [span(0, 1.7, 'C'), span(1.7, 2, 'G')],
      grid4(1)
    )
    expect(labels).toEqual(['C'])
  })

  it('keeps the whole-bar dominant when a half is mostly silence', () => {
    // The second half is uncovered: a "C _" split would print a phantom
    // change, so the bar stays a single-chord cell.
    const labels = chordLabelPerMeasure([span(0, 1, 'C')], grid4(1))
    expect(labels).toEqual(['C'])
  })

  it('splits a three-beat bar at its middle beat', () => {
    // 3/4 bar [0, 1.5): beats at 0, 0.5, 1 — the split lands on the third
    // beat (1.0s), so the change prints where it is felt (2 + 1 beats).
    const grid: BeatGrid = [
      { timeSeconds: 0, downbeat: true },
      { timeSeconds: 0.5, downbeat: false },
      { timeSeconds: 1, downbeat: false },
      { timeSeconds: 1.5, downbeat: true },
      { timeSeconds: 2, downbeat: false },
      { timeSeconds: 2.5, downbeat: false }
    ]
    const labels = chordLabelPerMeasure(
      [span(0, 1, 'C'), span(1, 3, 'G')],
      grid
    )
    expect(labels).toEqual(['C G', 'G'])
  })

  it('splits the final bar too, using its inherited length', () => {
    // The last downbeat's bar extends by the previous bar's length — the
    // half-split applies there like anywhere else.
    const grid: BeatGrid = [
      { timeSeconds: 0, downbeat: true },
      { timeSeconds: 2, downbeat: true }
    ]
    const labels = chordLabelPerMeasure(
      [span(0, 2, 'C'), span(2, 3, 'F'), span(3, 4, 'G')],
      grid
    )
    expect(labels).toEqual(['C', 'F G'])
  })

  it('ignores detection before the first downbeat (pickup)', () => {
    const grid: BeatGrid = [
      { timeSeconds: 1, downbeat: false },
      { timeSeconds: 2, downbeat: true },
      { timeSeconds: 4, downbeat: true }
    ]
    const labels = chordLabelPerMeasure([span(0, 6, 'C')], grid)
    expect(labels).toEqual(['C', 'C'])
  })

  it('yields nothing without a downbeat or without spans', () => {
    expect(chordLabelPerMeasure([span(0, 2, 'C')], [])).toEqual([])
    expect(chordLabelPerMeasure([], grid4(2))).toEqual([])
  })
})
