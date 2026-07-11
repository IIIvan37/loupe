import { transposeChartSource } from '@app/core'
import { useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { LeadSheet } from './lead-sheet.tsx'
import styles from './chord-chart-panel.module.css'

/** The lead-sheet's default layout: four bars to a row, the lead-sheet norm. */
const DEFAULT_BARS_PER_ROW = 4
/** The layout bounds — beyond them the sheet stops reading as a grid. */
const MIN_BARS_PER_ROW = 1
const MAX_BARS_PER_ROW = 12

interface ChordChartPanelProps {
  readonly source: string
  readonly onSourceChange: (source: string) => void
  /** The measure being played (global index), undefined to highlight nothing. */
  readonly currentMeasureIndex?: number | undefined
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
  currentMeasureIndex
}: ChordChartPanelProps) {
  const { t } = useLingui()
  // A render preference, not chart data — it lives with the panel (resets
  // with it on track change) and is never persisted.
  const [barsPerRow, setBarsPerRow] = useState(DEFAULT_BARS_PER_ROW)
  // What the field shows while being edited — an emptied or out-of-range
  // draft is no layout, so the sheet keeps the last committed value.
  const [barsDraft, setBarsDraft] = useState<string | undefined>(undefined)
  return (
    <section className={styles.panel}>
      {/* Not a <header>: Testing Library's role mapper would still expose it
          as a second `banner` landmark beside the app header. */}
      <div className={styles.header}>
        <h2 className={styles.title}>
          {t({ id: 'chords.title', message: "Grille d'accords" })}
        </h2>
        <span className={styles.layout}>
          <input
            type="number"
            className={styles.barsField}
            inputMode="numeric"
            min={MIN_BARS_PER_ROW}
            max={MAX_BARS_PER_ROW}
            value={barsDraft ?? barsPerRow}
            onChange={(event) => {
              setBarsDraft(event.target.value)
              const bars = Number(event.target.value)
              if (
                Number.isInteger(bars) &&
                bars >= MIN_BARS_PER_ROW &&
                bars <= MAX_BARS_PER_ROW
              ) {
                setBarsPerRow(bars)
              }
            }}
            onBlur={() => setBarsDraft(undefined)}
            aria-label={t({
              id: 'chords.bars-per-row',
              message: 'Mesures par ligne'
            })}
          />
          {t({ id: 'chords.bars-per-row-unit', message: 'mes. / ligne' })}
        </span>
        <span className={styles.transpose}>
          <button
            type="button"
            className={styles.transposeButton}
            onClick={() => onSourceChange(transposeChartSource(source, -1))}
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
            onClick={() => onSourceChange(transposeChartSource(source, 1))}
            aria-label={t({
              id: 'chords.transpose-up',
              message: 'Transposer un demi-ton vers le haut'
            })}
          >
            +½
          </button>
        </span>
      </div>
      <LeadSheet
        source={source}
        currentMeasureIndex={currentMeasureIndex}
        barsPerRow={barsPerRow}
      />
      <textarea
        className={styles.input}
        value={source}
        onChange={(event) => onSourceChange(event.target.value)}
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
    </section>
  )
}
