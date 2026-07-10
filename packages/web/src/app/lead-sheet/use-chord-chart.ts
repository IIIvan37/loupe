import { useState } from 'react'

/**
 * The chord chart's source text as session state. The text is the user's edit
 * (the parsed chart is derived at render), so this is what a save persists and
 * what a project open restores — the same instance the panel edits.
 */
export interface ChordChartState {
  readonly source: string
  /** Typing and restoring are the same move: seat this exact text. */
  readonly setSource: (source: string) => void
  /** A fresh track starts with an empty grid. */
  readonly reset: () => void
}

export function useChordChart(): ChordChartState {
  const [source, setSource] = useState('')
  return { source, setSource, reset: () => setSource('') }
}
