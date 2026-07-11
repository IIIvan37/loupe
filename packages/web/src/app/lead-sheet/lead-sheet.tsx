import { type ChordChart, formatChordSymbol, parseChart } from '@app/core'
import { type CSSProperties, useCallback, useMemo } from 'react'
import { cx } from '../../lib/cx.ts'
import styles from './lead-sheet.module.css'

interface LeadSheetProps {
  /** The chord grid in the home text format (`[Section]` + `| … |` rows). */
  readonly source: string
  /**
   * The measure being played, counted through the whole chart (sections are a
   * reading aid, not a reset). Undefined — before the first downbeat, or with
   * no beat grid at all — highlights nothing.
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
  // The playhead's measure counts through the whole chart, not per section.
  let global = 0
  return chart.sections.map((section, s) => {
    const measures = section.measures.map((measure, m) => ({
      key: `s${s}m${m}`,
      current: global++ === currentMeasureIndex,
      chords: measure.chords.map((chord, c) => ({
        key: `s${s}m${m}c${c}`,
        text: formatChordSymbol(chord)
      }))
    }))
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
  currentMeasureIndex,
  barsPerRow
}: LeadSheetProps) {
  // The sheet re-renders on every playhead frame during playback (the parent
  // ticks); only re-parse and re-key when the inputs actually change.
  const sections = useMemo(
    () => keyed(parseChart(source), currentMeasureIndex),
    [source, currentMeasureIndex]
  )
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
  return (
    <div className={styles.sheet} style={layout}>
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
                className={cx(styles.measure, measure.current && styles.current)}
                aria-current={measure.current ? 'true' : undefined}
              >
                {measure.chords.map((chord) => (
                  <span key={chord.key} className={styles.chord}>
                    {chord.text}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
