import { formatTimecode, type MarkerList } from '@app/core'
import { Tabs } from '@base-ui-components/react/tabs'
import { cx } from '../../lib/cx.ts'
import styles from './analysis-panel.module.css'

interface AnalysisPanelProps {
  readonly markers: MarkerList
  /** Jump to a marker's time. */
  readonly onSeekMarker: (timeSeconds: number) => void
}

/**
 * Dumb presentational analysis panel built on Base UI Tabs (headless + a11y).
 * « Repères » lists the real markers (click to seek); spectrum and notes are
 * honest placeholders for later jalons.
 */
export function AnalysisPanel({ markers, onSeekMarker }: AnalysisPanelProps) {
  return (
    <aside className={styles.panel}>
      <Tabs.Root defaultValue="reperes">
        <Tabs.List className={cx(styles.list)}>
          <Tabs.Tab value="spectre" className={cx(styles.tab)}>
            Spectre
          </Tabs.Tab>
          <Tabs.Tab value="reperes" className={cx(styles.tab)}>
            Repères
          </Tabs.Tab>
          <Tabs.Tab value="notes" className={cx(styles.tab)}>
            Notes
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="spectre" className={cx(styles.tabPanel)}>
          L'analyse spectrale arrivera avec la détection (jalon ultérieur).
        </Tabs.Panel>

        <Tabs.Panel value="reperes" className={cx(styles.tabPanel)}>
          {markers.length === 0 ? (
            <p>Aucun repère. Ajoute-en depuis la barre de repères.</p>
          ) : (
            <ul className={styles.markerList}>
              {markers.map((marker) => (
                <li key={marker.id}>
                  <button
                    type="button"
                    className={styles.markerRow}
                    onClick={() => onSeekMarker(marker.timeSeconds)}
                  >
                    <span className={styles.markerTime}>
                      {formatTimecode(marker.timeSeconds)}
                    </span>
                    <span className={styles.markerName}>{marker.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="notes" className={cx(styles.tabPanel)}>
          Les annotations textuelles arriveront plus tard.
        </Tabs.Panel>
      </Tabs.Root>
    </aside>
  )
}
