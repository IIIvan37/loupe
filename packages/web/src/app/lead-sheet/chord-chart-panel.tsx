import {
  type Accidental,
  chartDiagnostics,
  chartMatchesPitch,
  keyName,
  parseChart,
  parseKeyName,
  respellChartSource,
  transposeKey
} from '@app/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { printUnavailableOnDesktop } from '../desktop/desktop-export.ts'
import { LiveStatus } from '../ui/live-status.tsx'
import { signedSemitones } from '../ui/signed-semitones.ts'
import { useTwoStepConfirm } from '../ui/use-two-step-confirm.ts'
import type { ChartHeaderData } from './chart-header.tsx'
import { BarsPerRowField } from './bars-per-row-field.tsx'
import {
  DEFAULT_BARS_PER_ROW,
  readStoredBarsPerRow
} from './bars-per-row-preference.ts'
import { chartHasContent } from './chart-content.ts'
import { FormatHelpDialog } from './format-help-dialog.tsx'
import { LeadSheet } from './lead-sheet.tsx'
import styles from './chord-chart-panel.module.css'

interface ChordChartPanelProps {
  readonly source: string
  readonly onSourceChange: (source: string) => void
  /** Transpose the whole grid by a signed number of semitones — the owner
   * rewrites the source AND accounts for the key change (`transposedBy`). */
  readonly onTranspose: (delta: number) => void
  /** The live audio pitch shift, in semitones (0 = original key). */
  readonly pitchSemitones: number
  /** How far the grid's key has been transposed from its written key. */
  readonly transposedBy: number
  /** The measure being PLAYED (the n-th downbeat, counted through the
   * unrolled form — see LeadSheet), undefined to highlight nothing. */
  readonly currentMeasureIndex?: number | undefined
  /** The session-derived chart head (tags, BPM, bar length) — see LeadSheet. */
  readonly header?: ChartHeaderData | undefined
  /** Tap a measure to seek playback to it — see LeadSheet. */
  readonly onSelectMeasure?: ((writtenIndex: number) => void) | undefined
}

/** The panel's action bar: title, layout, transpose, print, edit, help.
 *  Not a <header>: Testing Library's role mapper would still expose it as a
 *  second `banner` landmark beside the app header. */
function PanelHeader({
  barsPerRow,
  onBarsPerRow,
  onTranspose,
  printable,
  editing,
  editorId,
  onToggleEdit,
  onOpenHelp
}: {
  readonly barsPerRow: number
  readonly onBarsPerRow: (value: number) => void
  readonly onTranspose: (delta: number) => void
  readonly printable: boolean
  readonly editing: boolean
  readonly editorId: string
  readonly onToggleEdit: () => void
  readonly onOpenHelp: () => void
}) {
  const { t } = useLingui()
  return (
    <div className={styles.header}>
      {/* h3: the panel title steps down under its zone's h2 (Partition) —
          the outline mirrors the section nesting Q.1 introduced. */}
      <h3 className={styles.title}>
        {t({ id: 'chords.title', message: "Grille d'accords" })}
      </h3>
      <BarsPerRowField value={barsPerRow} onChange={onBarsPerRow} />
      <span className={styles.transpose}>
        <button
          type="button"
          className={styles.transposeButton}
          onClick={() => onTranspose(-1)}
          aria-label={t({
            id: 'chords.transpose-down',
            message: 'Transposer un demi-ton vers le bas'
          })}
        >
          −½
        </button>
        <button
          type="button"
          className={styles.transposeButton}
          onClick={() => onTranspose(1)}
          aria-label={t({
            id: 'chords.transpose-up',
            message: 'Transposer un demi-ton vers le haut'
          })}
        >
          +½
        </button>
      </span>
      <button
        type="button"
        className={styles.printButton}
        // A source that renders no chart would print a blank page — the
        // action waits for content, the same test the sheet uses to emit
        // its print region. window.print() has no delegate in the desktop
        // webview (AH.1): disabled with a hint, never a silent no-op.
        disabled={!printable || printUnavailableOnDesktop()}
        title={
          printUnavailableOnDesktop()
            ? t({
                id: 'chords.print-desktop-soon',
                message: "Impression bientôt disponible sur l'app de bureau"
              })
            : undefined
        }
        onClick={() => window.print()}
      >
        {t({ id: 'chords.print', message: 'Imprimer' })}
      </button>
      <button
        type="button"
        className={styles.editToggle}
        aria-expanded={editing}
        aria-controls={editorId}
        onClick={onToggleEdit}
      >
        {t({ id: 'chords.edit', message: 'Modifier' })}
      </button>
      <button type="button" className={styles.helpButton} onClick={onOpenHelp}>
        {t({ id: 'chords.format-help', message: 'Aide du format' })}
      </button>
    </div>
  )
}

/** The two count-bearing warnings ride explicit ICU plurals — the catalog's
 *  precedent (`analyser.summary-sections`) — resolved via the msg-descriptor
 *  path like `analysis-summary.ts`. */
const PARSE_SUSPECTS = msg({
  id: 'chords.parse-suspects',
  message:
    '{count, plural, one {# accord douteux : {examples}} other {# accords douteux : {examples}}}'
})
const PARSE_UNREACHABLE = msg({
  id: 'chords.parse-unreachable',
  message:
    '{count, plural, one {# mesure jamais jouée par la forme} other {# mesures jamais jouées par la forme}}'
})

/** The key line (AN.3): where the grid sits relative to its written key, the
 *  way back, and the ♯/♭ respell — spelling is a reading preference, never a
 *  pitch move. */
function KeyRow({
  transposedBy,
  keys,
  onTranspose,
  onRespell
}: {
  readonly transposedBy: number
  /** The written → current key names, or undefined when no {key} names the
      grid — always both or neither. */
  readonly keys: { readonly written: string; readonly current: string } | undefined
  readonly onTranspose: (delta: number) => void
  readonly onRespell: (accidental: Accidental) => void
}) {
  const { t } = useLingui()
  return (
    <div className={styles.keyRow}>
      {transposedBy !== 0 && (
        <>
          <KeyShift keys={keys} offset={signedSemitones(transposedBy)} />
          <button
            type="button"
            className={styles.keyReset}
            onClick={() => onTranspose(-transposedBy)}
          >
            {t({
              id: 'chords.key-reset',
              message: 'Revenir à la tonalité écrite'
            })}
          </button>
        </>
      )}
      <span className={styles.respell}>
        <button
          type="button"
          className={styles.respellButton}
          aria-label={t({
            id: 'chords.respell-sharp',
            message: 'Épeler en dièses'
          })}
          onClick={() => onRespell('sharp')}
        >
          ♯
        </button>
        <button
          type="button"
          className={styles.respellButton}
          aria-label={t({
            id: 'chords.respell-flat',
            message: 'Épeler en bémols'
          })}
          onClick={() => onRespell('flat')}
        >
          ♭
        </button>
      </span>
    </div>
  )
}

/** Where the grid sits: « Tonalité : C → Eb (+3) » when a {key} names it,
 *  the bare signed offset otherwise. Only rendered while transposed. */
function KeyShift({
  keys,
  offset
}: {
  readonly keys:
    | { readonly written: string; readonly current: string }
    | undefined
  readonly offset: string
}) {
  const { t } = useLingui()
  if (keys === undefined) {
    return (
      <span className={styles.keyShift}>
        {t({
          id: 'chords.key-shift-offset',
          message: `Grille transposée de ${offset}`
        })}
      </span>
    )
  }
  const { written, current } = keys
  return (
    <span className={styles.keyShift}>
      {t({
        id: 'chords.key-shift',
        message: `Tonalité : ${written} → ${current} (${offset})`
      })}
    </span>
  )
}

/** The feedback line's count: what the grammar read, total and — once the
 *  caret sits on a measure row — on that line. Locals are bound so the ICU
 *  placeholders keep readable names (`onLine` is that line's measure count,
 *  never a line number). */
function ParseCount({
  measures,
  onLine
}: {
  readonly measures: number
  readonly onLine: number | undefined
}) {
  const { t } = useLingui()
  return (
    <span className={styles.parseCount}>
      {onLine === undefined
        ? t({
            id: 'chords.parse-count',
            message: `Mesures lues : ${measures}`
          })
        : t({
            id: 'chords.parse-count-line',
            message: `Mesures lues : ${measures} · sur cette ligne : ${onLine}`
          })}
    </span>
  )
}

/** Tokens the parser read as chords but that cannot honestly be ones. */
function SuspectsWarning({
  count,
  examples
}: {
  readonly count: number
  readonly examples: string
}) {
  const { i18n } = useLingui()
  return (
    <span className={styles.parseWarning} data-parse-warning="">
      {i18n._({ ...PARSE_SUSPECTS, values: { count, examples } })}
    </span>
  )
}

/** Written measures the unrolled form never plays (dead tail, volta above the
 *  pass count) — the chart claims bars the listener will never hear. */
function UnreachableWarning({ count }: { readonly count: number }) {
  const { i18n } = useLingui()
  return (
    <span className={styles.parseWarning} data-parse-warning="">
      {i18n._({ ...PARSE_UNREACHABLE, values: { count } })}
    </span>
  )
}

/**
 * Manual chord-chart entry: type the grid in the home text format and watch the
 * lead-sheet render live above it. Dumb — the source text is session state
 * owned by the shell (`useChordChart`), so it survives the panel unmounting
 * and rides the project save/open lifecycle. Transposing rewrites that same
 * source (layout preserved), so the result persists like any edit.
 */
export function ChordChartPanel({
  source,
  onSourceChange,
  onTranspose,
  pitchSemitones,
  transposedBy,
  currentMeasureIndex,
  header,
  onSelectMeasure
}: ChordChartPanelProps) {
  const { t } = useLingui()
  // A render preference, not chart data — it rides localStorage (per browser)
  // so the chosen layout survives reloads without touching the manifest.
  const [barsPerRow, setBarsPerRow] = useState(
    () => readStoredBarsPerRow() ?? DEFAULT_BARS_PER_ROW
  )
  // The chart is the view; the source editor is a mode, folded by default
  // (P.3). View state only — the source itself stays lifted in the shell.
  const [editing, setEditing] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  // Ties the disclosure button to the region it reveals (aria-controls): the
  // textarea sits far below the toggle in the DOM, AT needs the link.
  const editorId = useId()
  useEffect(() => {
    // Unfolding is an explicit request to type — hand the editor the focus
    // (an effect, not autoFocus: the mount is user-triggered, not page load).
    if (editing) {
      editorRef.current?.focus()
    }
  }, [editing])
  // What « Imprimer » guards on, plus the grid's named key (AN.3) — one
  // parse serves both. The sheet parses the same source anyway, so an extra
  // parse per source change is nothing — no lifted state needed.
  const { printable, currentKey } = useMemo(() => {
    const parsed = parseChart(source)
    const named = parsed.directives['key']
    return {
      printable: chartHasContent(parsed),
      currentKey: named === undefined ? undefined : parseKeyName(named)
    }
  }, [source])
  // The written → current key pair, nameable only when a {key} directive
  // names the grid — one value, so the two names can never half-exist.
  const keyShift =
    currentKey === undefined
      ? undefined
      : {
          written: keyName(transposeKey(currentKey, -transposedBy)),
          current: keyName(currentKey)
        }

  /** Re-spell the whole grid in the chosen accidental — pitch untouched.
      A spelling-identical result (blank grid, already-sharp grid under ♯)
      commits nothing: `onSourceChange` rides the edit path, whose structure
      sync must not re-fire — let alone wipe markers — for a visual no-op. */
  function respell(accidental: Accidental): void {
    const respelled = respellChartSource(source, accidental)
    if (respelled !== source) {
      onSourceChange(respelled)
    }
  }
  // The measure↔text machinery (AN.1 locus + AN.2 diagnostics), one walk:
  // spans, per-line counts, suspect tokens, unreachable bars. Editing only —
  // the reading view (and print) consumes none of it, so it computes nothing.
  const diagnostics = useMemo(
    () => (editing ? chartDiagnostics(source) : undefined),
    [editing, source]
  )
  const spans = diagnostics?.spans
  // The source line under the editor's caret — view state. The highlight
  // DERIVES from (editing, caretLine), so folding the editor away retires the
  // locus without a state sync; the stale line simply stops mattering.
  const [caretLine, setCaretLine] = useState<number | undefined>(undefined)

  /** While editing, a measure tap lands the cursor on the bar's tokens. */
  function locateMeasure(writtenIndex: number): void {
    const span = spans?.[writtenIndex]
    const editor = editorRef.current
    if (span === undefined || editor === null) {
      return
    }
    editor.focus()
    editor.setSelectionRange(span.start, span.end)
    setCaretLine(span.line)
  }

  /** Follow the caret as it moves (click, arrows, typing) — `select` fires
      on every selection change, including the collapsed caret. The line is
      counted on the DOM value, never the `source` prop: within a keystroke's
      event batch the prop lags the textarea, and the caret indexes the DOM. */
  function onEditorSelect(event: React.SyntheticEvent<HTMLTextAreaElement>): void {
    const { selectionStart, value } = event.currentTarget
    setCaretLine(value.slice(0, selectionStart).split('\n').length - 1)
  }

  // The written measures the caret's line holds — their boxes light up so the
  // sheet always shows where the typing lands.
  const activeSourceMeasures = useMemo(() => {
    if (spans === undefined || caretLine === undefined) {
      return undefined
    }
    return new Set(
      spans.flatMap((span, index) => (span.line === caretLine ? [index] : []))
    )
  }, [spans, caretLine])
  // The parse feedback's sheet marking (AN.2) — a swallowed token or a dead
  // bar never stays silent. Undefined outside editing: unannotated sheet.
  const suspectMeasures = useMemo(
    () =>
      diagnostics === undefined
        ? undefined
        : new Set(diagnostics.suspectTokens.map((token) => token.measure)),
    [diagnostics]
  )
  const unreachableMeasures = useMemo(
    () =>
      diagnostics === undefined
        ? undefined
        : new Set(diagnostics.unreachableMeasures),
    [diagnostics]
  )
  const caretLineCount =
    caretLine === undefined
      ? undefined
      : diagnostics?.measuresPerLine.get(caretLine)
  // The doubtful tokens, deduplicated for the warning line (a repeated typo
  // reads once); an ellipsis owns up to the ones not shown.
  const distinctSuspects = [
    ...new Set((diagnostics?.suspectTokens ?? []).map((token) => token.token))
  ]
  const suspectExamples =
    distinctSuspects.slice(0, 3).join(', ') +
    (distinctSuspects.length > 3 ? ', …' : '')
  // The « transposing instruments » gap: the audio plays in one key, the grid
  // shows another. Octave-equivalent keys name the same chords, so the flag
  // compares modulo 12; the button still applies the exact gap so the offset
  // accounting stays true to the audible shift.
  const pitchDrift = pitchSemitones - transposedBy
  const gridDiverges =
    source.trim().length > 0 && !chartMatchesPitch(transposedBy, pitchSemitones)
  const pitch = signedSemitones(pitchSemitones)
  const grid = signedSemitones(transposedBy)
  // Following rewrites the whole grid in one click — like the detected draft,
  // armed work deserves a « Confirmer ? » beat before being rewritten.
  const follow = useTwoStepConfirm<true>()
  const [followedAnnounce, setFollowedAnnounce] = useState<string | undefined>(
    undefined
  )

  function onFollowClick(): void {
    if (follow.pending === null) {
      follow.arm(true)
      return
    }
    follow.disarm()
    onTranspose(pitchDrift)
    setFollowedAnnounce(
      t({ id: 'chords.followed', message: 'Grille transposée' })
    )
  }

  return (
    <section className={styles.panel}>
      <PanelHeader
        barsPerRow={barsPerRow}
        onBarsPerRow={setBarsPerRow}
        onTranspose={onTranspose}
        printable={printable}
        editing={editing}
        editorId={editorId}
        onToggleEdit={() => setEditing((open) => !open)}
        onOpenHelp={() => setHelpOpen(true)}
      />
      <KeyRow
        transposedBy={transposedBy}
        keys={keyShift}
        onTranspose={onTranspose}
        onRespell={respell}
      />
      <FormatHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      {gridDiverges && (
        <div className={styles.pitchDrift}>
          <p className={styles.hint}>
            {t({
              id: 'chords.pitch-mismatch',
              message: `Audio transposé de ${pitch} demi-tons, grille de ${grid} — la grille ne suit pas.`
            })}
          </p>
          <button
            type="button"
            className={styles.followButton}
            onClick={onFollowClick}
            onBlur={follow.disarm}
          >
            {follow.pending
              ? t({
                  id: 'chords.follow-pitch-confirm',
                  message: 'Réécrire la grille ?'
                })
              : t({
                  id: 'chords.follow-pitch',
                  message: 'Transposer la grille pour suivre'
                })}
          </button>
        </div>
      )}
      {/* The panel's one live region, mounted outside the conditional rows:
          the flag row unmounts the instant the grid follows, but the
          announcement must still be spoken. */}
      <LiveStatus message={followedAnnounce} />
      {/* A detected chart spans the whole track (~120 measures in one click):
          the scrollport bounds the sheet so it never stretches the page and
          pushes the transport out of the viewport (K.1). The marker declares
          it as THE box the sheet's playhead follow may scroll — and no other. */}
      <div className={styles.sheetViewport} data-sheet-scrollport>
        <LeadSheet
          source={source}
          header={header}
          currentMeasureIndex={currentMeasureIndex}
          // Editing swaps the tap's meaning: locate the bar's source text
          // instead of seeking — even with no beat grid to seek along.
          onSelectMeasure={editing ? locateMeasure : onSelectMeasure}
          locating={editing}
          activeSourceMeasures={activeSourceMeasures}
          suspectMeasures={suspectMeasures}
          unreachableMeasures={unreachableMeasures}
          barsPerRow={barsPerRow}
        />
      </div>
      {/* The always-visible textarea used to teach the grid format via its
          placeholder; folded away, an empty panel would show nothing at all —
          this line re-establishes the first-run guidance. */}
      {!editing && source.trim().length === 0 && (
        <p className={styles.hint}>
          {t({
            id: 'chords.empty-hint',
            message:
              'Aucune grille — saisir les accords via « Modifier » ou lancer la détection.'
          })}
        </p>
      )}
      {diagnostics !== undefined && (
        <div className={styles.parseFeedback}>
          <ParseCount
            measures={diagnostics.measureCount}
            onLine={caretLineCount}
          />
          {diagnostics.suspectTokens.length > 0 && (
            <SuspectsWarning
              count={diagnostics.suspectTokens.length}
              examples={suspectExamples}
            />
          )}
          {diagnostics.unreachableMeasures.length > 0 && (
            <UnreachableWarning
              count={diagnostics.unreachableMeasures.length}
            />
          )}
        </div>
      )}
      {editing && (
        <textarea
          ref={editorRef}
          id={editorId}
          className={styles.input}
          value={source}
          onChange={(event) => onSourceChange(event.target.value)}
          onSelect={onEditorSelect}
          // No caret, no locus: leaving the field (transpose, help dialog)
          // must not keep asserting « typing lands here ». A measure tap
          // re-arms it — its blur lands before the button's click.
          onBlur={() => setCaretLine(undefined)}
          rows={6}
          spellCheck={false}
          aria-label={t({
            id: 'chords.input-label',
            message: "Saisir la grille d'accords"
          })}
          placeholder={t({
            id: 'chords.placeholder',
            message: '[Couplet]\n| C | Am | F | G |'
          })}
        />
      )}
    </section>
  )
}
