import { useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { LeadSheet } from './lead-sheet.tsx'
import styles from './chord-chart-panel.module.css'

/**
 * Manual chord-chart entry: type the grid in the home text format and watch the
 * lead-sheet render live above it. The draft lives in local state for now —
 * persisting it into the project is a later increment.
 */
export function ChordChartPanel() {
  const { t } = useLingui()
  const [source, setSource] = useState('')
  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>
        {t({ id: 'chords.title', message: "Grille d'accords" })}
      </h2>
      <LeadSheet source={source} />
      <textarea
        className={styles.input}
        value={source}
        onChange={(event) => setSource(event.target.value)}
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
