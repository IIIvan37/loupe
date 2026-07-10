import { useLingui } from '@lingui/react/macro'
import { LeadSheet } from './lead-sheet.tsx'
import styles from './chord-chart-panel.module.css'

interface ChordChartPanelProps {
  readonly source: string
  readonly onSourceChange: (source: string) => void
}

/**
 * Manual chord-chart entry: type the grid in the home text format and watch the
 * lead-sheet render live above it. Dumb — the source text is session state
 * owned by the shell (`useChordChart`), so it survives the panel unmounting
 * and rides the project save/open lifecycle.
 */
export function ChordChartPanel({
  source,
  onSourceChange
}: ChordChartPanelProps) {
  const { t } = useLingui()
  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>
        {t({ id: 'chords.title', message: "Grille d'accords" })}
      </h2>
      <LeadSheet source={source} />
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
