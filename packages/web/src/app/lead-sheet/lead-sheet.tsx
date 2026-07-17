import {
  type ChordChart,
  formatChordSymbol,
  parseChart,
  unrollChart
} from '@app/core'
import { useLingui } from '@lingui/react/macro'
import { type CSSProperties, useCallback, useMemo } from 'react'
import { cx } from '../../lib/cx.ts'
import { chartHasContent } from './chart-content.ts'
import { ChartHeader, type ChartHeaderData } from './chart-header.tsx'
import { ChordGlyph } from './chord-glyph.tsx'
import styles from './lead-sheet.module.css'
import { TimeSignature } from './time-signature.tsx'

interface LeadSheetProps {
  /** The chord grid in the home text format (`[Section]` + `| … |` rows). */
  readonly source: string
  /**
   * The session-derived chart head (tags, BPM, bar length) — the source's own
   * `{k: v}` directives override it field by field. Absent = no derivation.
   */
  readonly header?: ChartHeaderData | undefined
  /**
   * The measure being PLAYED, counted through the unrolled form (the n-th
   * downbeat plays the n-th unrolled measure — repeats and D.C. highlight
   * their written measure again on each pass). Undefined — before the first
   * downbeat, past the unrolled form, or with no beat grid — highlights
   * nothing.
   */
  readonly currentMeasureIndex?: number | undefined
  /**
   * How many bars each row lays out — a RENDER parameter (never part of the
   * chart model, see the plan). Undefined falls back to the stylesheet's 4.
   */
  readonly barsPerRow?: number | undefined
  /**
   * Tap a measure to seek playback to it (its WRITTEN index, counted through
   * the whole chart). Absent — no grid to seek along — keeps the measures
   * inert `<div>`s: no lying affordance.
   */
  readonly onSelectMeasure?: ((writtenIndex: number) => void) | undefined
}

interface KeyedChord {
  readonly key: string
  readonly text: string
}
interface KeyedMeasure {
  readonly key: string
  /** The measure's WRITTEN index, global across sections. */
  readonly index: number
  readonly current: boolean
  readonly chords: readonly KeyedChord[]
  readonly repeatStart: boolean
  readonly repeatEnd: boolean
  /** The `:| xN` pass count printed over the closing repeat bar. */
  readonly repeatCount?: number
  /** The volta number bracketing this measure; `voltaOpens` marks the
      measure that prints it (the bracket line spans the whole ending). */
  readonly volta?: number
  readonly voltaOpens: boolean
  readonly fermata: boolean
  /** The D.C. / Fine mark(s) printed over this measure's closing bar. */
  readonly markAfter?: string
  readonly codaHere: boolean
  /** The `{time: N/M}` signature taking over on this measure, if any. */
  readonly meterHere?: string
}
interface KeyedSection {
  readonly key: string
  readonly label?: string
  readonly measures: readonly KeyedMeasure[]
}

interface MeasureBoxProps {
  /** Interactive = a tap seeks; otherwise an inert <div> (same skin). */
  readonly interactive: boolean
  /** The measure's 1-based written number — the button's accessible name. */
  readonly number: number
  readonly onSelect: () => void
  readonly ref: ((node: HTMLElement | null) => void) | undefined
  readonly className: string
  readonly 'aria-current': 'true' | undefined
  readonly 'data-repeat-start': true | undefined
  readonly 'data-repeat-end': true | undefined
  readonly children: React.ReactNode
}

/**
 * One measure box: a seek `<button>` when the sheet is navigable, the same
 * box as an inert `<div>` when it is not (print, no grid) — the chords stay
 * plain content either way, the button's name is its aria-label.
 */
function MeasureBox({
  interactive,
  number,
  onSelect,
  ref,
  children,
  ...shared
}: MeasureBoxProps) {
  const { t } = useLingui()
  if (!interactive) {
    return (
      <div ref={ref} {...shared}>
        {children}
      </div>
    )
  }
  return (
    <button
      type="button"
      ref={ref}
      aria-label={t({
        id: 'chart.measure-seek',
        message: `Aller à la mesure ${number}`
      })}
      onClick={onSelect}
      {...shared}
    >
      {children}
    </button>
  )
}

/**
 * Shape the chart for rendering: the grid never reorders and carries no per-item
 * state, so a positional path is a stable sibling-unique key. Computing it here,
 * off the JSX, keeps the render a plain map over identified nodes.
 */
function keyed(
  chart: ChordChart,
  meterAt: ReadonlyMap<number, string>,
  currentMeasureIndex?: number
): readonly KeyedSection[] {
  const form = chart.form
  // The playhead's measure counts through the whole chart, not per section.
  let global = 0
  // A volta prints its number once, on the measure opening the group.
  let previousVolta: number | undefined
  return chart.sections.map((section, s) => {
    const measures = section.measures.map((measure, m) => {
      const index = global++
      const voltaOpens =
        measure.volta !== undefined && measure.volta !== previousVolta
      previousVolta = measure.volta
      // The D.C. / Fine marks sit over the bar CLOSING the measure before
      // their line; the coda sign opens the measure its section starts on.
      const markAfter = [
        ...(form?.fine === index + 1 ? ['Fine'] : []),
        ...(form?.dc === index + 1 ? ['D.C.'] : [])
      ].join(' · ')
      const meterHere = meterAt.get(index)
      return {
        key: `s${s}m${m}`,
        index,
        current: index === currentMeasureIndex,
        chords: measure.chords.map((chord, c) => ({
          key: `s${s}m${m}c${c}`,
          text: formatChordSymbol(chord)
        })),
        repeatStart: measure.repeatStart === true,
        repeatEnd: measure.repeatEnd === true,
        ...(measure.repeatCount !== undefined && {
          repeatCount: measure.repeatCount
        }),
        ...(measure.volta !== undefined && { volta: measure.volta }),
        voltaOpens,
        fermata: measure.fermata === true,
        ...(markAfter !== '' && { markAfter }),
        codaHere: form?.coda === index,
        ...(meterHere !== undefined && { meterHere })
      }
    })
    const base = { key: `s${s}`, measures }
    return section.label === undefined
      ? base
      : { ...base, label: section.label }
  })
}

/**
 * A read-only lead-sheet: the grid `source` parsed into sections of measures and
 * laid out as bars in a row. Pure presentation — all parsing lives in the core;
 * the layout is plain CSS grid, no library.
 */
export function LeadSheet({
  source,
  header,
  currentMeasureIndex,
  barsPerRow,
  onSelectMeasure
}: LeadSheetProps) {
  // The sheet re-renders on every playhead frame during playback (the parent
  // ticks); only re-parse and re-key when the inputs actually change.
  // Parsing and unrolling depend on the source alone; only the (cheap)
  // keying re-runs as the playhead moves from measure to measure.
  const { chart, unrolled, meterAt } = useMemo(() => {
    const parsed = parseChart(source)
    // Signature changes are recorded at their written measure — index the
    // lookup here, off the per-measure keying pass the playhead re-runs.
    return {
      chart: parsed,
      unrolled: unrollChart(parsed),
      meterAt: new Map(
        (parsed.meterChanges ?? []).map((change) => [
          change.measure,
          change.signature
        ])
      )
    }
  }, [source])
  const { sections, directives } = useMemo(() => {
    // The playhead index counts PLAYED measures; the form's unroll says which
    // written measure that is (a repeat highlights the same bar twice).
    const written =
      currentMeasureIndex === undefined
        ? undefined
        : unrolled[currentMeasureIndex]
    return {
      sections: keyed(chart, meterAt, written),
      directives: chart.directives
    }
  }, [chart, meterAt, unrolled, currentMeasureIndex])
  const layout =
    barsPerRow === undefined
      ? undefined
      : ({ '--bars-per-row': barsPerRow } as CSSProperties)
  // Follow the playhead: React invokes this ref exactly when a measure BECOMES
  // current (the ref prop flips undefined → callback), so it fires once per
  // measure change, never per playhead frame. `nearest` only scrolls the first
  // scrollable ancestor (the panel's scrollport) and is a no-op when the sheet
  // fits without one — the component stays print-first.
  const followPlayhead = useCallback((node: HTMLElement | null) => {
    node?.scrollIntoView({ block: 'nearest' })
  }, [])
  // A chart head over no chart is noise (and would double the app header's
  // title): the head only prints once the source holds a grid or directives.
  const hasChart = chartHasContent(chart)
  // The whole-chart signature, as stave notation at the head of the first
  // system (the mockup's stacked 4-over-4 before the opening barline) — the
  // source's {time:} directive wins over the session's bar length, exactly
  // like every other head field. An empty directive overrides nothing.
  const signature =
    (directives.time ? directives.time : undefined) ??
    (header?.beatsPerBar === undefined
      ? undefined
      : `${header.beatsPerBar}/4`)
  return (
    // data-print-region anchors the print stylesheet (global.css): everything
    // outside this subtree is hidden when printing, the sheet fills the page.
    // The stylesheet fires on the attribute's PRESENCE, so an empty sheet
    // must not carry it — Cmd+P would print a blank page instead of the app.
    <div
      className={styles.sheet}
      style={layout}
      data-print-region={hasChart || undefined}
    >
      {hasChart && (
        <ChartHeader derived={header ?? {}} directives={directives} />
      )}
      {sections.map((section, index) => (
        <section key={section.key}>
          {section.label !== undefined && (
            <h3 className={styles.label}>{section.label}</h3>
          )}
          <div className={styles.row}>
            {index === 0 && signature !== undefined && (
              <TimeSignature
                signature={signature}
                className={styles.headSignature}
              />
            )}
            {section.measures.map((measure) => (
              // Tap-to-seek (iReal/Chordify standard) when a handler exists;
              // otherwise the measure stays an inert <div> — no lying button.
              <MeasureBox
                key={measure.key}
                interactive={onSelectMeasure !== undefined}
                ref={measure.current ? followPlayhead : undefined}
                number={measure.index + 1}
                onSelect={() => onSelectMeasure?.(measure.index)}
                className={cx(
                  styles.measure,
                  measure.current && styles.current,
                  measure.volta !== undefined && styles.volta
                )}
                aria-current={measure.current ? 'true' : undefined}
                data-repeat-start={measure.repeatStart || undefined}
                data-repeat-end={measure.repeatEnd || undefined}
              >
                {measure.codaHere && (
                  <span className={styles.codaSign}>⊕</span>
                )}
                {measure.meterHere !== undefined && (
                  <TimeSignature
                    signature={measure.meterHere}
                    className={styles.meterSign}
                  />
                )}
                {measure.voltaOpens && (
                  <span className={styles.voltaLabel}>{measure.volta}.</span>
                )}
                {measure.fermata && (
                  <span className={styles.fermata}>𝄐</span>
                )}
                {measure.chords.map((chord) => (
                  <ChordGlyph key={chord.key} text={chord.text} />
                ))}
                {measure.repeatCount !== undefined && (
                  <span className={styles.passCount}>
                    ×{measure.repeatCount}
                  </span>
                )}
                {measure.markAfter !== undefined && (
                  <span className={styles.formMark}>{measure.markAfter}</span>
                )}
              </MeasureBox>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
