import {
  chartTransposedBy,
  type ProjectChordChart,
  transposeChart
} from '@app/core'
import { useState } from 'react'

/**
 * The chord chart's session state: the source text as the user's edit (the
 * parsed chart is derived at render) plus the transposition offset — how far
 * the grid's key has drifted from the key it was written/detected in. The two
 * move together as one state value (`transposeChart` rewrites text AND offset
 * in a single pure move), so this is what a save persists and what a project
 * open restores — the same instance the panel edits.
 */
export interface ChordChartState {
  readonly source: string
  /** Semitones the grid has been transposed by since written/detected. */
  readonly transposedBy: number
  /** Typing seats this exact text — an edit is not a key change, EXCEPT that
   * clearing the grid is the escape hatch from the key accounting: a
   * wholesale rewrite passes through blank and starts over at offset 0. */
  readonly setSource: (source: string) => void
  /** Rewrite every chord by `delta` semitones and account for it. */
  readonly transpose: (delta: number) => void
  /** Seat a detected draft: fresh text, in the track's original key. */
  readonly seatDraft: (source: string) => void
  /** Seat a persisted chart — absent field or chart reads as untransposed. */
  readonly restore: (chart: ProjectChordChart | undefined) => void
  /** A fresh track starts with an empty, untransposed grid. */
  readonly reset: () => void
}

export function useChordChart(): ChordChartState {
  const [chart, setChart] = useState({ source: '', transposedBy: 0 })
  function seat(source: string, transposedBy: number): void {
    setChart({ source, transposedBy })
  }
  return {
    ...chart,
    setSource: (source) =>
      setChart((current) => ({
        source,
        transposedBy: source.trim() === '' ? 0 : current.transposedBy
      })),
    transpose: (delta) => setChart((current) => transposeChart(current, delta)),
    seatDraft: (draft) => seat(draft, 0),
    restore: (persisted) =>
      seat(persisted?.source ?? '', chartTransposedBy(persisted)),
    reset: () => seat('', 0)
  }
}
