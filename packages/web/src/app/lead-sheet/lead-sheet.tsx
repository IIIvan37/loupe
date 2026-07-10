import { type ChordChart, formatChordSymbol, parseChart } from '@app/core'
import styles from './lead-sheet.module.css'

interface LeadSheetProps {
  /** The chord grid in the home text format (`[Section]` + `| … |` rows). */
  readonly source: string
}

interface KeyedChord {
  readonly key: string
  readonly text: string
}
interface KeyedMeasure {
  readonly key: string
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
function keyed(chart: ChordChart): readonly KeyedSection[] {
  return chart.sections.map((section, s) => {
    const measures = section.measures.map((measure, m) => ({
      key: `s${s}m${m}`,
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
export function LeadSheet({ source }: LeadSheetProps) {
  const sections = keyed(parseChart(source))
  return (
    <div className={styles.sheet}>
      {sections.map((section) => (
        <section key={section.key} className={styles.section}>
          {section.label !== undefined && (
            <h3 className={styles.label}>{section.label}</h3>
          )}
          <div className={styles.row}>
            {section.measures.map((measure) => (
              <div key={measure.key} className={styles.measure}>
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
