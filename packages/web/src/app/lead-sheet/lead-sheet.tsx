import {
  type ChordChart,
  formatChordSymbol,
  parseChart,
  unrollChart
} from '@app/core'
import { type CSSProperties, useCallback, useMemo } from 'react'
import { cx } from '../../lib/cx.ts'
import { chartHasContent } from './chart-content.ts'
import { ChartHeader, type ChartHeaderData } from './chart-header.tsx'
import { ChordGlyph } from './chord-glyph.tsx'
import styles from './lead-sheet.module.css'

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
}

interface KeyedChord {
  readonly key: string
  readonly text: string
}
interface KeyedMeasure {
  readonly key: string
  readonly current: boolean
  readonly chords: readonly KeyedChord[]
  readonly repeatStart: boolean
  readonly repeatEnd: boolean
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

/**
 * Shape the chart for rendering: the grid never reorders and carries no per-item
 * state, so a positional path is a stable sibling-unique key. Computing it here,
 * off the JSX, keeps the render a plain map over identified nodes.
 */
function keyed(
  chart: ChordChart,
  currentMeasureIndex?: number
): readonly KeyedSection[] {
  const form = chart.form
  // Signature changes are recorded at their written measure — index the lookup.
  const meterAt = new Map(
    (chart.meterChanges ?? []).map((change) => [
      change.measure,
      change.signature
    ])
  )
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
      return {
        key: `s${s}m${m}`,
        current: index === currentMeasureIndex,
        chords: measure.chords.map((chord, c) => ({
          key: `s${s}m${m}c${c}`,
          text: formatChordSymbol(chord)
        })),
        repeatStart: measure.repeatStart === true,
        repeatEnd: measure.repeatEnd === true,
        ...(measure.volta !== undefined && { volta: measure.volta }),
        voltaOpens,
        fermata: measure.fermata === true,
        ...(markAfter !== '' && { markAfter }),
        codaHere: form?.coda === index,
        ...(meterAt.has(index) && { meterHere: meterAt.get(index) as string })
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
  barsPerRow
}: LeadSheetProps) {
  // The sheet re-renders on every playhead frame during playback (the parent
  // ticks); only re-parse and re-key when the inputs actually change.
  // Parsing and unrolling depend on the source alone; only the (cheap)
  // keying re-runs as the playhead moves from measure to measure.
  const { chart, unrolled } = useMemo(() => {
    const parsed = parseChart(source)
    return { chart: parsed, unrolled: unrollChart(parsed) }
  }, [source])
  const { sections, directives } = useMemo(() => {
    // The playhead index counts PLAYED measures; the form's unroll says which
    // written measure that is (a repeat highlights the same bar twice).
    const written =
      currentMeasureIndex === undefined
        ? undefined
        : unrolled[currentMeasureIndex]
    return {
      sections: keyed(chart, written),
      directives: chart.directives
    }
  }, [chart, unrolled, currentMeasureIndex])
  const layout =
    barsPerRow === undefined
      ? undefined
      : ({ '--bars-per-row': barsPerRow } as CSSProperties)
  // Follow the playhead: React invokes this ref exactly when a measure BECOMES
  // current (the ref prop flips undefined → callback), so it fires once per
  // measure change, never per playhead frame. `nearest` only scrolls the first
  // scrollable ancestor (the panel's scrollport) and is a no-op when the sheet
  // fits without one — the component stays print-first.
  const followPlayhead = useCallback((node: HTMLDivElement | null) => {
    node?.scrollIntoView({ block: 'nearest' })
  }, [])
  // A chart head over no chart is noise (and would double the app header's
  // title): the head only prints once the source holds a grid or directives.
  const hasChart = chartHasContent(chart)
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
      {sections.map((section) => (
        <section key={section.key} className={styles.section}>
          {section.label !== undefined && (
            <h3 className={styles.label}>{section.label}</h3>
          )}
          <div className={styles.row}>
            {section.measures.map((measure) => (
              <div
                key={measure.key}
                ref={measure.current ? followPlayhead : undefined}
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
                  <span className={styles.meterSign}>{measure.meterHere}</span>
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
                {measure.markAfter !== undefined && (
                  <span className={styles.formMark}>{measure.markAfter}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
