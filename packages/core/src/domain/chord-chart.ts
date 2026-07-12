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
  /**
   * The head-of-source `{key: value}` overrides (`{title: …}`, `{key: …}`,
   * `{tempo: …}`…) that make a chart self-supporting away from its session.
   * Keys are lowercased; only lines BEFORE any grid content count — P.2's form
   * grammar owns in-grid `{…}` lines.
   */
  readonly directives: Readonly<Record<string, string>>
}

const HEADER = /^\[(.*)\]$/

/** A full-line `{key: value}` directive — the value keeps any later colons. */
const DIRECTIVE = /^\{([^:{}]+):([^{}]*)\}$/

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
    .map((line) => {
      // Directive lines hold prose, not chords (`{title: C major}` must not
      // move) — except `{key: …}`, whose pitch names the grid's key and MUST
      // follow the transposition or the printed head would lie. Its value
      // rides the normal token rewrite: the pitch round-trips, the rest
      // (`{key:`, a mode word) fails the round-trip guard and stays verbatim.
      const directive = DIRECTIVE.exec(line.trim())
      const prose =
        directive !== null &&
        (directive[1] as string).trim().toLowerCase() !== 'key'
      if (prose || HEADER.test(line.trim())) return line
      return line.replace(TOKEN, (token) => {
        const parsed = parseChordSymbol(token)
        if (formatChordSymbol(parsed) !== token) return token
        return formatChordSymbol(transposeChordSymbol(parsed, semitones))
      })
    })
    .join('\n')
}

/**
 * Transpose a chart AND its key accounting as one move, so the two can never
 * desync: the source text is rewritten (layout preserved) and `transposedBy`
 * — how far the grid's key sits from the key it was written in — absorbs the
 * same delta. The no-op guards protect the pairing: a blank grid must not
 * accrue an invisible offset that would corrupt the next grid typed over it,
 * and a non-integer move leaves both halves untouched (the text would not
 * move either). A whole-octave move keeps the text verbatim but still counts
 * — the offset is exact key accounting, octave equivalence belongs to
 * `chartMatchesPitch`.
 */
export function transposeChart(
  chart: { readonly source: string; readonly transposedBy: number },
  semitones: number
): { readonly source: string; readonly transposedBy: number } {
  if (!Number.isInteger(semitones) || chart.source.trim() === '') {
    return chart
  }
  return {
    source: transposeChartSource(chart.source, semitones),
    transposedBy: chart.transposedBy + semitones
  }
}

/**
 * Whether a grid transposed by `transposedBy` names the right chords for
 * audio pitch-shifted by `pitchSemitones`. Octave moves preserve every chord
 * symbol (pitch classes are unchanged), so the comparison is modulo 12 — a
 * +12 shift over an untouched grid is NOT a divergence.
 */
export function chartMatchesPitch(
  transposedBy: number,
  pitchSemitones: number
): boolean {
  return (pitchSemitones - transposedBy) % 12 === 0
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
  const directives: Record<string, string> = {}
  let current: { label?: string; measures: Measure[] } | undefined

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (line.length === 0) continue

    // Directives may only lead the source: once any grid content (a section
    // header or a row) has started, a `{…}` line is grid content too.
    if (sections.length === 0) {
      const directive = DIRECTIVE.exec(line)
      if (directive) {
        directives[(directive[1] as string).trim().toLowerCase()] = (
          directive[2] as string
        ).trim()
        continue
      }
    }

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

  return { sections, directives }
}
