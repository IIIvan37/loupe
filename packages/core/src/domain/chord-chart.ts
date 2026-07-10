import { type ChordSymbol, parseChordSymbol } from './chord-symbol.ts'

/**
 * A lead-sheet as pure musical structure: sections of measures, each measure
 * holding the chords played in that bar. No time is stored — a measure maps onto
 * a downbeat interval of the beat grid only when rendered, so the chart stays
 * printable and valid on its own.
 */
export interface Measure {
  readonly chords: readonly ChordSymbol[]
}

export interface Section {
  readonly label?: string
  readonly measures: readonly Measure[]
}

export interface ChordChart {
  readonly sections: readonly Section[]
}

const HEADER = /^\[(.*)\]$/

/** The bars of one `| … | … |` row — each non-empty cell is a measure. */
function parseRow(line: string): Measure[] {
  return line
    .split('|')
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0)
    .map((cell) => ({ chords: cell.split(/\s+/).map(parseChordSymbol) }))
}

export function parseChart(text: string): ChordChart {
  const sections: Section[] = []
  let current: { label?: string; measures: Measure[] } | undefined

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (line.length === 0) continue

    const header = HEADER.exec(line)
    if (header) {
      current = { label: header[1] as string, measures: [] }
      sections.push(current)
      continue
    }

    if (!current) {
      current = { measures: [] }
      sections.push(current)
    }
    current.measures.push(...parseRow(line))
  }

  return { sections }
}
