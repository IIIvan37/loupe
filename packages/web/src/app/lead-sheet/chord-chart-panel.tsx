import { transposeChartSource } from '@app/core'
import { useLingui } from '@lingui/react/macro'
import { LeadSheet } from './lead-sheet.tsx'
import styles from './chord-chart-panel.module.css'

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
  return (
    <section className={styles.panel}>
      {/* Not a <header>: Testing Library's role mapper would still expose it
          as a second `banner` landmark beside the app header. */}
      <div className={styles.header}>
        <h2 className={styles.title}>
          {t({ id: 'chords.title', message: "Grille d'accords" })}
        </h2>
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
      <LeadSheet source={source} currentMeasureIndex={currentMeasureIndex} />
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
