import {
  type ChordSymbol,
  formatChordSymbol,
  parseChordSymbol,
  transposeChordSymbol
} from './chord-symbol.ts'

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

/** The single token grammar of a row: anything between bar lines and spaces.
    Shared by the parser and the transposer so the two can never drift. */
const TOKEN = /[^|\s]+/g

/** The bars of one `| … | … |` row — each non-empty cell is a measure. */
function parseRow(line: string): Measure[] {
  return line
    .split('|')
    .map((cell) => cell.match(TOKEN) ?? [])
    .filter((tokens) => tokens.length > 0)
    .map((tokens) => ({ chords: tokens.map(parseChordSymbol) }))
}

/**
 * Transpose the grid's SOURCE TEXT — the persisted truth the panel edits — so
 * the user's layout (headers, rows, blank lines, spacing) survives verbatim;
 * only chord tokens are rewritten. A token the grammar cannot re-print exactly
 * (parse∘format is not the identity, e.g. `C/E/G`) passes through verbatim —
 * rewriting it would silently destroy part of the saved source. A non-integer
 * move returns the source untouched; whole-octave moves are the identity too,
 * through `transposeNote`'s own guard (flat spellings survive).
 */
export function transposeChartSource(
  source: string,
  semitones: number
): string {
  if (!Number.isInteger(semitones)) return source
  return source
    .split('\n')
    .map((line) =>
      HEADER.test(line.trim())
        ? line
        : line.replace(TOKEN, (token) => {
            const parsed = parseChordSymbol(token)
            if (formatChordSymbol(parsed) !== token) return token
            return formatChordSymbol(transposeChordSymbol(parsed, semitones))
          })
    )
    .join('\n')
}

/** How a blank measure prints: the lead-sheet's own "no chord" token. It parses
    as an unknown pitch name, so transposition passes it through verbatim. */
const NO_CHORD = 'N.C.'

/**
 * Print measure labels as grid source text — `| C | Am | F | G |` rows of
 * `barsPerRow` — the draft the chord detection pre-fills and the user corrects.
 * Lives with the parser so the printer can never drift from the row grammar: a
 * blank measure, or a label that is not exactly one `TOKEN` (empty, spaced,
 * containing a bar line), prints as `N.C.` — anything else would change the
 * measure count under `parseChart` and shift every following bar off its
 * downbeat.
 */
export function renderChartSource(
  labels: readonly (string | undefined)[],
  barsPerRow: number
): string {
  const width = Math.max(1, Math.floor(barsPerRow) || 1)
  const rows: string[] = []
  for (let start = 0; start < labels.length; start += width) {
    const cells = labels.slice(start, start + width)
    rows.push(`| ${cells.map((label) => cellToken(label)).join(' | ')} |`)
  }
  return rows.join('\n')
}

/** The single token a cell may print — `N.C.` when the label isn't one. */
function cellToken(label: string | undefined): string {
  return label !== undefined && label.match(TOKEN)?.join('') === label
    ? label
    : NO_CHORD
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
