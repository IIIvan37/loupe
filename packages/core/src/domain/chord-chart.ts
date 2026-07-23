import { keyAccidental, parseKeyName } from './chord-key.ts'
import {
  type Accidental,
  type ChordSymbol,
  formatChordSymbol,
  parseChordSymbol,
  pitchClassOf,
  respellChordSymbol,
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
  /** Opened by a `|:` bar — playback comes back here on the repeat. */
  readonly repeatStart?: true
  /** Closed by a `:|` bar — playback jumps back from here. */
  readonly repeatEnd?: true
  /** The alternative ending this measure belongs to (`|1.` / `|2.` bars). */
  readonly volta?: number
  /** Total passes of the repeat a `:| xN` closes — a bare `:|` is the
      implicit 2. Only set on a `repeatEnd` measure. */
  readonly repeatCount?: number
  /** A `@` suffix on any of the measure's chords — hold the last one. */
  readonly fermata?: true
}

export interface Section {
  readonly label?: string
  readonly measures: readonly Measure[]
}

/**
 * The chart's navigation marks, each a position in WRITTEN measures (the count
 * of measures before the mark's line): `dc` = the D.C. jump ("go back to the
 * top" — its position doubles as the to-coda point), `coda` = where the ⊕ coda
 * starts, `fine` = where the replayed pass ends.
 */
export interface ChartForm {
  readonly dc?: number
  readonly coda?: number
  readonly fine?: number
}

/**
 * A time-signature change in the grid: from the `measure`-th WRITTEN measure
 * on, the chart is felt in `signature` (`2/4`). Set by a full-line
 * `{time: N/M}` between rows — the standard (ChordPro) meter notation — like a
 * printed signature change, it holds until the next one.
 */
export interface MeterChange {
  readonly measure: number
  readonly signature: string
}

export interface ChordChart {
  readonly sections: readonly Section[]
  /** Present only when the source carries `{d.c.}` / `{coda}` / `{fine}`. */
  readonly form?: ChartForm
  /** Present only when the source carries mid-grid `{time: N/M}` lines. */
  readonly meterChanges?: readonly MeterChange[]
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

/** The bars of one `| … | … |` row — each non-empty cell is a measure. A
    volta number spans its row (a two-bar ending is one bracket in print) up
    to and including the bar its `:|` closes. */
function parseRow(line: string): Measure[] {
  let carriedVolta: number | undefined
  const measures: Measure[] = []
  const cells = line
    .split('|')
    .map((cell) => cell.match(TOKEN) ?? [])
    .filter((tokens) => tokens.length > 0)
  for (const tokens of cells) {
    const count = repeatCountCell(tokens, measures.at(-1))
    if (count !== undefined) {
      measures[measures.length - 1] = {
        ...(measures.at(-1) as Measure),
        repeatCount: count
      }
      continue
    }
    const measure = parseCell(tokens)
    const volta = measure.volta ?? carriedVolta
    carriedVolta = measure.repeatEnd === true ? undefined : volta
    measures.push(volta === undefined ? measure : { ...measure, volta })
  }
  return measures
}

/** A repeat's pass count: the `x3` (or `×3`) after a closing `:|` bar. */
const REPEAT_COUNT = /^[x×](\d+)$/i

/** A lone `xN` cell right after a bare `:|` bar of the SAME row reads as the
    repeat's pass count, not a measure. Anywhere else (no repeat to count, a
    volta's `:|`) the token stays a chord cell — consuming it would silently
    change the measure count and shift every later bar off its downbeat. */
function repeatCountCell(
  tokens: readonly string[],
  previous: Measure | undefined
): number | undefined {
  if (tokens.length !== 1) return undefined
  const count = REPEAT_COUNT.exec(tokens[0] as string)
  if (
    count === null ||
    previous?.repeatEnd !== true ||
    previous.volta !== undefined
  ) {
    return undefined
  }
  return Number(count[1])
}

/** One cell's tokens into a measure: edge `:` tokens are the repeat bars of
    `|:` / `:|` (split on `|` leaves them at the cell's edges), never chords. */
/** A volta bar's number token: `1.` right after the opening bar line. */
const VOLTA = /^(\d+)\.$/

function parseCell(tokens: readonly string[]): Measure {
  const repeatStart = tokens[0] === ':'
  const inner = repeatStart ? tokens.slice(1) : [...tokens]
  const volta = VOLTA.exec(inner[0] ?? '')
  if (volta) inner.shift()
  const repeatEnd = inner.at(-1) === ':'
  if (repeatEnd) inner.pop()
  const fermata = inner.some((token) => FERMATA.test(token))
  return {
    chords: inner.map((token) => parseChordSymbol(stripFermata(token))),
    ...(repeatStart && { repeatStart }),
    ...(repeatEnd && { repeatEnd }),
    ...(volta && { volta: Number(volta[1]) }),
    ...(fermata && { fermata })
  }
}

/** A fermata suffix: `C@` holds the chord. A lone `@` is no chord, so the
    suffix only counts on a non-empty head. */
const FERMATA = /.@$/

function stripFermata(token: string): string {
  return FERMATA.test(token) ? token.slice(0, -1) : token
}

/** Parse a token's head and prove the grammar can re-print it exactly, or
    undefined (`C/E/G` re-prints as `C/E` — the G would be destroyed). The ONE
    round-trip gate shared by the source rewriters and the diagnostics, so the
    two can never disagree on which tokens are safely chords. */
function reprintableChordSymbol(head: string): ChordSymbol | undefined {
  const parsed = parseChordSymbol(head)
  return formatChordSymbol(parsed) === head ? parsed : undefined
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
  return rewriteChordTokens(source, (symbol) =>
    transposeChordSymbol(symbol, semitones)
  )
}

/**
 * Re-spell the grid's SOURCE TEXT under the key's accidental convention — a
 * flat key rewrites `A#` to `Bb` — without moving any pitch. Layout and
 * qualities survive verbatim (only the enharmonic spelling of roots and basses
 * changes); a token that would not round-trip passes through untouched, exactly
 * as for the transposer. The `{key: …}` directive's own pitch is re-spelled
 * too, so the printed head names the key in its own accidental.
 */
export function respellChartSource(
  source: string,
  accidental: Accidental
): string {
  return rewriteChordTokens(source, (symbol) =>
    respellChordSymbol(symbol, accidental)
  )
}

/**
 * Rewrite every chord token in the source through `rewrite`, preserving the
 * user's layout to the character. Directive lines hold prose, not chords
 * (`{title: C major}` must stay put) — except `{key: …}`, whose pitch names the
 * grid's key and must follow the rewrite (its value rides the normal token
 * pass: the pitch round-trips, the `{key:` and any mode word fail the guard and
 * stay verbatim). A fermata suffix is peeled before the round-trip guard so
 * `C/E@` still rewrites, then re-appended. A token the grammar cannot re-print
 * exactly passes through untouched — rewriting it would destroy saved source.
 */
function rewriteChordTokens(
  source: string,
  rewrite: (symbol: ChordSymbol) => ChordSymbol
): string {
  return source
    .split('\n')
    .map((line) => {
      const directive = DIRECTIVE.exec(line.trim())
      const prose =
        directive !== null &&
        (directive[1] as string).trim().toLowerCase() !== 'key'
      if (prose || HEADER.test(line.trim())) return line
      return line.replace(TOKEN, (token) => {
        const head = stripFermata(token)
        const hold = head !== token
        const parsed = reprintableChordSymbol(head)
        if (parsed === undefined) return token
        const rewritten = formatChordSymbol(rewrite(parsed))
        return hold ? `${rewritten}@` : rewritten
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
  const moved = transposeChartSource(chart.source, semitones)
  return {
    // A whole-octave move keeps the text verbatim (transposeNote's own
    // guard) — never re-spell what did not move.
    source: semitones % 12 === 0 ? moved : respellUnderKey(moved),
    transposedBy: chart.transposedBy + semitones
  }
}

/**
 * Re-spell a transposed source under its ARRIVAL key (AN.3): the transposer
 * spells with sharps, but `{key: C}` moved up one lands in Db — a flat key
 * whose grid must read `Db | Bbm`, never `C# | A#m`. The `{key: …}` directive
 * (already transposed by the same move) decides; a missing or unparseable key
 * keeps the transposer's sharp default. A SHARP arrival key skips the pass:
 * every moved token already came out sharp-spelled, so the respell would be a
 * no-op walk — and skipping keeps the rule explicit: only the accidental the
 * move itself got wrong is corrected, never the user's own spelling at rest.
 */
function respellUnderKey(source: string): string {
  const keyDirective = parseChart(source).directives['key']
  if (keyDirective === undefined) {
    return source
  }
  const key = parseKeyName(keyDirective)
  if (key === undefined || keyAccidental(key) !== 'flat') {
    return source
  }
  return respellChartSource(source, 'flat')
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
 * A label may hold several single-space-separated chords (`'C G'`, the
 * two-chord bar): the cell prints them all, still one measure. Lives with the
 * parser so the printer can never drift from the row grammar: a blank measure,
 * or a label that would not round-trip as the same cell (empty, irregular
 * spacing, a bar line, a structural token), prints as `N.C.` — anything else
 * would change the measure count under `parseChart` and shift every following
 * bar off its downbeat.
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

/**
 * Whether one token can sit in a printed cell: exactly one `TOKEN` (no bar
 * line, no whitespace) that `parseCell` would not re-read structurally (a
 * bare `:`, a volta `1.`, a fermata `@`). Exported for the structure
 * relabel, so it keeps a bar's printable chords instead of wiping the whole
 * cell when one token cannot be re-printed.
 */
export function isPrintableToken(token: string): boolean {
  return (
    token.match(TOKEN)?.join('') === token &&
    token !== ':' &&
    !VOLTA.test(token) &&
    !REPEAT_COUNT.test(token) &&
    !FERMATA.test(token)
  )
}

/** The tokens a cell may print — `N.C.` when the label isn't a single-space
    join of printable tokens: anything else would change the measure count
    or the chords read back under `parseChart`. */
function cellToken(label: string | undefined): string {
  const tokens = label?.match(TOKEN)
  return tokens != null &&
    tokens.join(' ') === label &&
    tokens.every(isPrintableToken)
    ? label
    : NO_CHORD
}

/** The `ChartForm` key each full-line form mark sets — the single source the
    recognizer regex derives from, so a new mark can never miss the pattern. */
const FORM_KEYS: Readonly<Record<string, keyof ChartForm>> = {
  'd.c.': 'dc',
  coda: 'coda',
  fine: 'fine'
}

/** A full-line form mark — `{d.c.}` / `{coda}` / `{fine}`, case-insensitive. */
const FORM_MARK = new RegExp(
  String.raw`^\{\s*(${Object.keys(FORM_KEYS)
    .map((mark) => mark.replaceAll('.', String.raw`\.`))
    .join('|')})\s*\}$`,
  'i'
)

/** A `{form: Nx}` head value: how many times the whole form plays (`3x`,
    `3 ×`). The count grammar of the body's `xN` cells, value-side. */
const FORM_ROLLOUT = /^(\d+)\s*[x×]$/i

/**
 * The pass count a `{form: …}` head directive carries, `undefined` when the
 * value is prose (or a count below 2 — the form already plays once): a
 * malformed value must never change playback, only ever multiply it.
 */
export function parseFormRollout(
  value: string | undefined
): number | undefined {
  const match = FORM_ROLLOUT.exec(value ?? '')
  if (match === null) return undefined
  const count = Number(match[1])
  return count >= 2 ? count : undefined
}

/**
 * Unroll a chart's form into the sequence of WRITTEN measure indices actually
 * played — the projection playback highlighting follows (the n-th downbeat
 * plays the n-th unrolled measure). A `{form: Nx}` head directive is the
 * song's ROLLOUT — the whole written form (repeats included) plays N times —
 * so the playhead keeps tracking choruses 2..N of a one-cycle grid.
 */
export function unrollChart(chart: ChordChart): readonly number[] {
  const single = unrollWrittenForm(chart)
  const rollout = parseFormRollout(chart.directives.form)
  if (rollout === undefined) return single
  return Array.from({ length: rollout }, () => single).flat()
}

/** One pass of the written form: repeats, voltas and D.C. as printed. */
function unrollWrittenForm(chart: ChordChart): readonly number[] {
  const measures = chart.sections.flatMap((section) => section.measures)
  const dc = chart.form?.dc
  if (dc === undefined) {
    return walkForm(measures, 0, measures.length)
  }
  // The D.C. bounds the first pass, then replays from the top: to the {fine}
  // when one is written (al Fine — it wins over a contradictory coda),
  // otherwise to the D.C. point again, landing on the {coda} when one is
  // written (al Coda — the D.C. position doubles as the to-coda sign) or
  // simply playing on through the tail, so no written measure is ever
  // unreachable behind a plain {d.c.}.
  const { fine, coda } = chart.form ?? {}
  const firstPass = walkForm(measures, 0, dc)
  const replay =
    fine !== undefined
      ? walkForm(measures, 0, fine)
      : [...firstPass, ...walkForm(measures, coda ?? dc, measures.length)]
  return [...firstPass, ...replay]
}

/**
 * Play the written measures from `from` until the boundary `until`, honouring
 * repeats and voltas. Terminates on any input: a jump strictly grows `pass`
 * under an unchanged `repeatFrom`, a fall-through strictly grows `repeatFrom`
 * — the walk's (repeatFrom, pass) state never repeats.
 */
function walkForm(
  measures: readonly Measure[],
  from: number,
  until: number
): number[] {
  const played: number[] = []
  let index = from
  let pass = 1
  let repeatFrom = from
  let jumped = false
  let inVolta = false
  while (index < until) {
    const measure = measures[index] as Measure
    // A fresh |: (not reached via a jump back to it) opens a new repeat, and
    // walking out of the last ending closes the volta group — either way the
    // form starts over here, at pass one. A volta-numbered bar never opens
    // one: its bracket belongs to the CURRENT repeat, whatever bars it
    // carries.
    if (
      !jumped &&
      measure.volta === undefined &&
      (measure.repeatStart || inVolta)
    ) {
      repeatFrom = index
      pass = 1
    }
    jumped = false
    if (measure.volta !== undefined) {
      inVolta = true
      if (measure.volta !== pass) {
        index += 1
        continue
      }
    } else {
      inVolta = false
    }
    played.push(index)
    if (measure.repeatEnd) {
      // A volta's :| always sends the walk back for the NEXT ending (it is
      // only ever reached on its own pass); a bare :| repeats until its pass
      // count — the implicit 2, or the `xN` it carries.
      if (measure.volta !== undefined || pass < (measure.repeatCount ?? 2)) {
        pass = (measure.volta ?? pass) + 1
        index = repeatFrom
        jumped = true
        continue
      }
      // Falling through a taken repeat closes it: the next bare :| repeats
      // from here, never from the closed repeat's own start.
      repeatFrom = index + 1
      pass = 1
    }
    index += 1
  }
  return played
}

/** A `{time: …}` payload: the numeric N/M signature (`4/4`, `6/8`). Only this
    qualifies as a meter mark; any other value stays grid content. */
const TIME_SIGNATURE = /^(\d+)\s*\/\s*(\d+)$/

/** A `{…}` line split into its trimmed lowercased key and trimmed value. */
function directiveOf(
  line: string
): { readonly key: string; readonly value: string } | undefined {
  const directive = DIRECTIVE.exec(line)
  if (!directive) return undefined
  return {
    key: (directive[1] as string).trim().toLowerCase(),
    value: (directive[2] as string).trim()
  }
}

/** The signature a mid-grid `{time: N/M}` line changes to, if the line is
    one — any other braced line stays grid content. */
function meterChangeOf(line: string): string | undefined {
  const directive = directiveOf(line)
  if (directive?.key !== 'time') return undefined
  const time = TIME_SIGNATURE.exec(directive.value)
  return time ? `${time[1]}/${time[2]}` : undefined
}

/** A section still under construction — measures stay appendable. */
interface DraftSection {
  label?: string
  measures: Measure[]
}

/** Append a row to the current section, opening an unlabelled one when no
    header has started a section yet. */
function appendRow(
  sections: DraftSection[],
  current: DraftSection | undefined,
  row: readonly Measure[]
): DraftSection {
  const target = current ?? { measures: [] }
  if (current === undefined) sections.push(target)
  target.measures.push(...row)
  return target
}

/** The `ChartForm` key a full-line form mark sets, if the line is one. */
function formKeyOf(line: string): keyof ChartForm | undefined {
  const mark = FORM_MARK.exec(line)
  if (!mark) return undefined
  return FORM_KEYS[(mark[1] as string).toLowerCase()]
}

export function parseChart(text: string): ChordChart {
  const sections: DraftSection[] = []
  const directives: Record<string, string> = {}
  const form: { -readonly [K in keyof ChartForm]: ChartForm[K] } = {}
  const meterChanges: MeterChange[] = []
  let written = 0
  let current: DraftSection | undefined

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (line.length === 0) continue

    const mark = formKeyOf(line)
    if (mark !== undefined) {
      form[mark] = written
      continue
    }

    // Directives may only lead the source: once any grid content (a section
    // header or a row) has started, a `{…}` line is grid content too.
    const head = sections.length === 0 ? directiveOf(line) : undefined
    if (head !== undefined) {
      directives[head.key] = head.value
      continue
    }

    // Mid-grid, a `{time: N/M}` line is a signature change (never reached at
    // the head — the directive branch above consumes it as the chart's meter).
    // It rides the SAME directive grammar as the head so the two can never
    // tokenize differently; only the payload check is its own.
    const signature = meterChangeOf(line)
    if (signature !== undefined) {
      meterChanges.push({ measure: written, signature })
      continue
    }

    const header = HEADER.exec(line)
    if (header) {
      current = { label: header[1] as string, measures: [] }
      sections.push(current)
      continue
    }

    const row = parseRow(line)
    written += row.length
    current = appendRow(sections, current, row)
  }

  return {
    sections,
    directives,
    ...(Object.keys(form).length > 0 && { form }),
    ...(meterChanges.length > 0 && { meterChanges })
  }
}

/** Where one written measure lives in the source text: its line (0-based) and
    the absolute [start, end) offsets of its cell's tokens — ready for a
    textarea `setSelectionRange`. */
export interface MeasureSourceSpan {
  readonly line: number
  readonly start: number
  readonly end: number
}

/** A token with its absolute offsets in the source — the diagnostic grain. */
interface TokenSpan {
  readonly text: string
  readonly start: number
  readonly end: number
}

/** One row cell with the raw-line offsets of each token — the positional twin
    of `parseRow`'s `split('|')`+`TOKEN` pass, so cells count identically. */
function rowCellSpans(rawLine: string): { tokens: TokenSpan[] }[] {
  const cells: { tokens: TokenSpan[] }[] = []
  let cellStart = 0
  for (let i = 0; i <= rawLine.length; i++) {
    if (i !== rawLine.length && rawLine[i] !== '|') continue
    const matches = [...rawLine.slice(cellStart, i).matchAll(TOKEN)]
    if (matches.length > 0) {
      cells.push({
        tokens: matches.map((match) => ({
          text: match[0],
          start: cellStart + match.index,
          end: cellStart + match.index + match[0].length
        }))
      })
    }
    cellStart = i + 1
  }
  return cells
}

/** One written measure located in the source: its span plus the tokens
    `parseCell` reads as CHORDS (structure — repeat dots, volta bars — is
    stripped, exactly as the parser strips it). */
interface MeasureSite {
  readonly span: MeasureSourceSpan
  readonly chordTokens: readonly TokenSpan[]
}

/**
 * The one positional walk under every measure↔text feature, in written order.
 * Mirrors `parseChart`'s line dispatch and `parseRow`'s cell walk statement
 * for statement (same `TOKEN` grammar, same repeat-count merge, same volta
 * carry — an `xN` after a volta's :| is a measure there, so it must be one
 * here), so the mapping and the parser can never drift; offsets are measured
 * on the RAW line — indentation the parser trims away still counts.
 */
function measureSites(source: string): MeasureSite[] {
  const sites: MeasureSite[] = []
  let offset = 0
  let gridStarted = false
  const lines = source.split('\n')
  for (const [lineIndex, rawLine] of lines.entries()) {
    const lineStart = offset
    offset += rawLine.length + 1
    const line = rawLine.trim()
    if (line.length === 0) continue
    if (formKeyOf(line) !== undefined) continue
    if (!gridStarted && directiveOf(line) !== undefined) continue
    if (meterChangeOf(line) !== undefined) continue
    if (HEADER.test(line)) {
      gridStarted = true
      continue
    }
    gridStarted = true
    sites.push(...rowMeasureSites(rawLine, lineIndex, lineStart))
  }
  return sites
}

/** parseRow's walk with positions: a repeat-count cell merges into the
    previous bar and owns no site. */
function rowMeasureSites(
  rawLine: string,
  line: number,
  lineStart: number
): MeasureSite[] {
  const sites: MeasureSite[] = []
  let previous: Measure | undefined
  let carriedVolta: number | undefined
  for (const cell of rowCellSpans(rawLine)) {
    // rowCellSpans never emits an empty cell — proven here, not assumed.
    const first = cell.tokens[0]
    const last = cell.tokens.at(-1)
    if (first === undefined || last === undefined) continue
    const texts = cell.tokens.map((token) => token.text)
    if (repeatCountCell(texts, previous) !== undefined) continue
    const measure = parseCell(texts)
    const volta = measure.volta ?? carriedVolta
    carriedVolta = measure.repeatEnd === true ? undefined : volta
    previous = volta === undefined ? measure : { ...measure, volta }
    sites.push({
      span: {
        line,
        start: lineStart + first.start,
        end: lineStart + last.end
      },
      chordTokens: chordTokensOf(cell.tokens).map((token) => ({
        text: token.text,
        start: lineStart + token.start,
        end: lineStart + token.end
      }))
    })
  }
  return sites
}

/** The cell's chord tokens — `parseCell`'s structural stripping (edge repeat
    dots, the volta bar's number) with positions kept. */
function chordTokensOf(tokens: readonly TokenSpan[]): readonly TokenSpan[] {
  const inner = tokens[0]?.text === ':' ? tokens.slice(1) : [...tokens]
  if (VOLTA.test(inner[0]?.text ?? '')) inner.shift()
  if (inner.at(-1)?.text === ':') inner.pop()
  return inner
}

/**
 * Map every written measure to its source span, in written order — the
 * measure↔text locus the editor needs (click a bar, land on its tokens).
 */
export function measureSourceSpans(
  source: string
): readonly MeasureSourceSpan[] {
  return measureSites(source).map((site) => site.span)
}

/** One token the parser read as a chord but that cannot honestly be one. */
export interface SuspectToken {
  readonly token: string
  /** The written index of the measure holding the token. */
  readonly measure: number
  readonly line: number
  readonly start: number
  readonly end: number
}

/** What the grid source actually says — the parse feedback the editor shows,
    so the grammar never swallows a mistake silently. */
export interface ChartDiagnostics {
  /** Total written measures. */
  readonly measureCount: number
  /** Every written measure's source span, in written order — the same array
      `measureSourceSpans` returns, carried here so one walk serves both the
      locus and the diagnostics. */
  readonly spans: readonly MeasureSourceSpan[]
  /** Written measures per source line — only lines holding measures appear. */
  readonly measuresPerLine: ReadonlyMap<number, number>
  /** Tokens read as chords that are unlikely to be chords. */
  readonly suspectTokens: readonly SuspectToken[]
  /** Written indices the unrolled form never plays (dead tail after a
      {d.c.}+{fine}, a volta above the pass count). */
  readonly unreachableMeasures: readonly number[]
}

/** Whether a chord token is believable: it must survive the parse∘format
    round-trip (a `C/E/G` silently drops its G) AND name real pitches — root
    and slash bass both, since `parseChordSymbol` is total: `x3`, `{x:` or
    `F/x` parse "fine" with pitches `x` and `{`. The fermata suffix is peeled
    first, like everywhere. */
function believableChord(token: string): boolean {
  const head = stripFermata(token)
  if (head === NO_CHORD) return true
  const parsed = reprintableChordSymbol(head)
  return (
    parsed !== undefined &&
    pitchClassOf(parsed.root) !== undefined &&
    (parsed.bass === undefined || pitchClassOf(parsed.bass) !== undefined)
  )
}

/**
 * Diagnose the grid source for the editor's parse feedback: how many measures
 * each line holds, which tokens were read as chords but cannot honestly be
 * ones (a swallowed `{x: y}` directive, an `xN` that is no pass count, a
 * slash chord the grammar cannot re-print), and which written measures the
 * unrolled form never plays. Pure derivation — same walk as
 * `measureSourceSpans`, same unroll as playback.
 */
export function chartDiagnostics(source: string): ChartDiagnostics {
  const sites = measureSites(source)
  const measuresPerLine = new Map<number, number>()
  const suspectTokens: SuspectToken[] = []
  for (const [measure, site] of sites.entries()) {
    measuresPerLine.set(
      site.span.line,
      (measuresPerLine.get(site.span.line) ?? 0) + 1
    )
    for (const token of site.chordTokens) {
      if (!believableChord(token.text)) {
        suspectTokens.push({
          token: token.text,
          measure,
          line: site.span.line,
          start: token.start,
          end: token.end
        })
      }
    }
  }
  const played = new Set(unrollChart(parseChart(source)))
  const unreachableMeasures = sites.flatMap((_, index) =>
    played.has(index) ? [] : [index]
  )
  return {
    measureCount: sites.length,
    spans: sites.map((site) => site.span),
    measuresPerLine,
    suspectTokens,
    unreachableMeasures
  }
}
