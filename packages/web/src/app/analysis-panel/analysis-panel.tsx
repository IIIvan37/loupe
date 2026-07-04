import {
  formatTimecode,
  type LoopLibrary,
  type MarkerList,
  type NamedLoop
} from '@app/core'
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
  /** The saved A/B loops (recall / rename / remove). */
  readonly loops: LoopLibrary
  /** The loop the active region came from — its row reads as selected. */
  readonly activeLoopId: string | null
  /** Recall a saved loop: make it active and seek to its start. */
  readonly onActivateLoop: (loop: NamedLoop) => void
  /** Re-save an existing loop after renaming it (same id and region). */
  readonly onUpdateLoop: (loop: NamedLoop) => void
  readonly onRemoveLoop: (id: string) => void
}

/**
 * Dumb presentational side panel built on Base UI Tabs (headless + a11y). It is
 * the navigation home: « Repères » lists the markers and « Boucles » the saved
 * A/B loops (both click-to-seek, rename, remove); spectrum and notes are honest
 * placeholders for later jalons.
 */
export function AnalysisPanel({
  markers,
  onSeekMarker,
  onRenameMarker,
  onRemoveMarker,
  loops,
  activeLoopId,
  onActivateLoop,
  onUpdateLoop,
  onRemoveLoop
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
          <Tabs.Tab value="boucles" className={cx(styles.tab)}>
            <Trans id="analysis.tab-loops">Boucles</Trans>
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
            <ul className={styles.entryList}>
              {markers.map((marker) => {
                // Bind to a local so the extracted ICU placeholder reads as {name}.
                const name = marker.label
                return (
                  <EntryRow
                    key={marker.id}
                    time={formatTimecode(marker.timeSeconds)}
                    name={name}
                    onSelect={() => onSeekMarker(marker.timeSeconds)}
                    renameTitle={t({
                      id: 'markers.rename-title',
                      message: 'Renommer le repère'
                    })}
                    renameLabel={t({
                      id: 'markers.rename-named',
                      message: `Renommer ${name}`
                    })}
                    onRename={(label) => onRenameMarker(marker.id, label)}
                    removeLabel={t({
                      id: 'markers.remove-named',
                      message: `Supprimer ${name}`
                    })}
                    onRemove={() => onRemoveMarker(marker.id)}
                  />
                )
              })}
            </ul>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="boucles" className={cx(styles.tabPanel)}>
          {loops.length === 0 ? (
            <p>
              <Trans id="analysis.no-loops">
                Aucune boucle. En enregistrer une depuis une sélection A/B sur la
                forme d'onde.
              </Trans>
            </p>
          ) : (
            <ul className={styles.entryList}>
              {loops.map((loop) => {
                // Bind to a local so the extracted ICU placeholder reads as {name}.
                const name = loop.name
                return (
                  <EntryRow
                    key={loop.id}
                    active={loop.id === activeLoopId}
                    time={`${formatTimecode(loop.region.startSeconds)}–${formatTimecode(loop.region.endSeconds)}`}
                    name={name}
                    onSelect={() => onActivateLoop(loop)}
                    renameTitle={t({
                      id: 'loops.rename-title',
                      message: 'Renommer la boucle'
                    })}
                    renameLabel={t({
                      id: 'loops.rename-named',
                      message: `Renommer ${name}`
                    })}
                    onRename={(nextName) =>
                      onUpdateLoop({ ...loop, name: nextName })
                    }
                    removeLabel={t({
                      id: 'loops.remove-named',
                      message: `Supprimer ${name}`
                    })}
                    onRemove={() => onRemoveLoop(loop.id)}
                  />
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

interface EntryRowProps {
  /** Preformatted time cell — a marker's timecode or a loop's start–end range. */
  readonly time: string
  readonly name: string
  /** Whether this row is the selected one (the active loop). */
  readonly active?: boolean
  /** Seek to the entry (a marker's time, a loop's start). */
  readonly onSelect: () => void
  readonly renameTitle: string
  readonly renameLabel: string
  readonly onRename: (name: string) => void
  readonly removeLabel: string
  readonly onRemove: () => void
}

/** One navigable list row shared by markers and saved loops. */
function EntryRow({
  time,
  name,
  active,
  onSelect,
  renameTitle,
  renameLabel,
  onRename,
  removeLabel,
  onRemove
}: EntryRowProps) {
  const { t } = useLingui()
  return (
    <li className={styles.entryItem}>
      <button
        type="button"
        className={cx(styles.entryRow, active && styles.entryActive)}
        aria-current={active ? 'true' : undefined}
        onClick={onSelect}
      >
        <span className={styles.entryTime}>{time}</span>
        <span className={styles.entryName}>{name}</span>
      </button>
      <NameEditor
        title={renameTitle}
        triggerClassName={cx(styles.entryEdit)}
        triggerLabel={renameLabel}
        triggerContent="✎"
        submitLabel={t({ id: 'common.rename', message: 'Renommer' })}
        initialName={name}
        onSubmit={onRename}
      />
      <button
        type="button"
        className={styles.entryRemove}
        aria-label={removeLabel}
        onClick={onRemove}
      >
        ✕
      </button>
    </li>
  )
}
