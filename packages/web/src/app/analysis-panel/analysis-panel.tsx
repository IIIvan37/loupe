import { formatTimecode, type MarkerList } from '@app/core'
import { Trans, useLingui } from '@lingui/react/macro'
import { Tabs } from '@base-ui-components/react/tabs'
import { cx } from '../../lib/cx.ts'
import { NameEditor } from '../ui/name-editor.tsx'
import styles from './analysis-panel.module.css'

interface AnalysisPanelProps {
  readonly markers: MarkerList
  /** Jump to a marker's time. */
  readonly onSeekMarker: (timeSeconds: number) => void
  readonly onRenameMarker: (id: string, label: string) => void
  readonly onRemoveMarker: (id: string) => void
}

/**
 * Dumb presentational analysis panel built on Base UI Tabs (headless + a11y).
 * « Repères » lists the real markers (click to seek); spectrum and notes are
 * honest placeholders for later jalons.
 */
export function AnalysisPanel({
  markers,
  onSeekMarker,
  onRenameMarker,
  onRemoveMarker
}: AnalysisPanelProps) {
  const { t } = useLingui()
  return (
    <aside className={styles.panel}>
      <Tabs.Root defaultValue="reperes">
        <Tabs.List className={cx(styles.list)}>
          <Tabs.Tab value="spectre" className={cx(styles.tab)}>
            <Trans id="analysis.tab-spectrum">Spectre</Trans>
          </Tabs.Tab>
          <Tabs.Tab value="reperes" className={cx(styles.tab)}>
            <Trans id="analysis.tab-markers">Repères</Trans>
          </Tabs.Tab>
          <Tabs.Tab value="notes" className={cx(styles.tab)}>
            <Trans id="analysis.tab-notes">Notes</Trans>
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="spectre" className={cx(styles.tabPanel)}>
          <Trans id="analysis.spectrum-placeholder">
            L'analyse spectrale arrivera avec la détection (jalon ultérieur).
          </Trans>
        </Tabs.Panel>

        <Tabs.Panel value="reperes" className={cx(styles.tabPanel)}>
          {markers.length === 0 ? (
            <p>
              <Trans id="analysis.no-markers">
                Aucun repère. En ajouter depuis la barre de repères.
              </Trans>
            </p>
          ) : (
            <ul className={styles.markerList}>
              {markers.map((marker) => {
                // Bind to a local so the extracted ICU placeholder reads as {name}.
                const name = marker.label
                return (
                  <li key={marker.id} className={styles.markerItem}>
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
                    <NameEditor
                      title={t({
                        id: 'markers.rename-title',
                        message: 'Renommer le repère'
                      })}
                      triggerClassName={cx(styles.markerEdit)}
                      triggerLabel={t({
                        id: 'markers.rename-named',
                        message: `Renommer ${name}`
                      })}
                      triggerContent="✎"
                      submitLabel={t({
                        id: 'common.rename',
                        message: 'Renommer'
                      })}
                      initialName={marker.label}
                      onSubmit={(label) => onRenameMarker(marker.id, label)}
                    />
                    <button
                      type="button"
                      className={styles.markerRemove}
                      aria-label={t({
                        id: 'markers.remove-named',
                        message: `Supprimer ${name}`
                      })}
                      onClick={() => onRemoveMarker(marker.id)}
                    >
                      ✕
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="notes" className={cx(styles.tabPanel)}>
          <Trans id="analysis.notes-placeholder">
            Les annotations textuelles arriveront plus tard.
          </Trans>
        </Tabs.Panel>
      </Tabs.Root>
    </aside>
  )
}
