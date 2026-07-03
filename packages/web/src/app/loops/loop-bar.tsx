import type { LoopLibrary, LoopRegion, NamedLoop } from '@app/core'
import { Trans, useLingui } from '@lingui/react/macro'
import { Cluster } from '../../layout/cluster/cluster.tsx'
import { cx } from '../../lib/cx.ts'
import { NameEditor } from '../ui/name-editor.tsx'
import styles from './loop-bar.module.css'

interface LoopBarProps {
  /** The active A/B region (drag on the waveform), or undefined when none. */
  readonly region: LoopRegion | undefined
  /** Whether the active region already belongs to a saved loop. */
  readonly isSaved: boolean
  /** The saved loop the region came from — its chip reads as selected. */
  readonly activeLoopId: string | null
  /** Whether the active region loops playback (vs playing through). */
  readonly loopEnabled: boolean
  readonly onToggleLoop: () => void
  readonly library: LoopLibrary
  /** Save the active region under a name (a fresh saved loop). */
  readonly onSaveRegion: (name: string, region: LoopRegion) => void
  /** Re-save an existing loop after renaming it. */
  readonly onUpdateLoop: (loop: NamedLoop) => void
  readonly onClearRegion: () => void
  readonly onActivate: (loop: NamedLoop) => void
  readonly onRemove: (id: string) => void
}

/**
 * Dumb bar: name/save the current loupe selection, and recall/rename/remove saved
 * loops. A loop's start/end are edited on the waveform handles, not here.
 */
export function LoopBar({
  region,
  isSaved,
  activeLoopId,
  loopEnabled,
  onToggleLoop,
  library,
  onSaveRegion,
  onUpdateLoop,
  onClearRegion,
  onActivate,
  onRemove
}: LoopBarProps) {
  const { t } = useLingui()
  const saveRegionLabel = t({
    id: 'loops.save-region',
    message: 'Enregistrer la boucle'
  })
  return (
    <Cluster gap="var(--space-xs)" align="center">
      <span className={styles.label}>
        <Trans id="loops.section-label">Boucles</Trans>
      </span>

      {region && (
        <>
          <button
            type="button"
            className={cx(styles.toggle, loopEnabled && styles.toggleOn)}
            aria-pressed={loopEnabled}
            onClick={onToggleLoop}
          >
            {loopEnabled ? (
              <Trans id="loops.active">⟳ Boucle active</Trans>
            ) : (
              <Trans id="loops.inactive">⟳ Boucle inactive</Trans>
            )}
          </button>
          {!isSaved && (
            <>
              <NameEditor
                title={saveRegionLabel}
                triggerClassName={cx(styles.action)}
                triggerLabel={saveRegionLabel}
                triggerContent={saveRegionLabel}
                submitLabel={t({ id: 'common.save', message: 'Enregistrer' })}
                initialName=""
                onSubmit={(name) => onSaveRegion(name, region)}
              />
              {/* Discard a throwaway selection. A saved loop is removed from its
                  chip (✕) instead, so the two actions never overlap. */}
              <button
                type="button"
                className={styles.ghost}
                onClick={onClearRegion}
              >
                <Trans id="loops.clear-region">Effacer</Trans>
              </button>
            </>
          )}
        </>
      )}

      {library.map((loop) => {
        // Bind to a local so the extracted ICU placeholder reads as {name}.
        const name = loop.name
        return (
          <span
            key={loop.id}
            className={cx(
              styles.saved,
              loop.id === activeLoopId && styles.savedActive
            )}
          >
            <button
              type="button"
              className={styles.recall}
              aria-current={loop.id === activeLoopId ? 'true' : undefined}
              onClick={() => onActivate(loop)}
            >
              {loop.name}
            </button>
            <NameEditor
              title={t({
                id: 'loops.rename-title',
                message: 'Renommer la boucle'
              })}
              triggerClassName={cx(styles.edit)}
              triggerLabel={t({
                id: 'loops.rename-named',
                message: `Renommer ${name}`
              })}
              triggerContent="✎"
              submitLabel={t({ id: 'common.rename', message: 'Renommer' })}
              initialName={loop.name}
              onSubmit={(nextName) => onUpdateLoop({ ...loop, name: nextName })}
            />
            <button
              type="button"
              className={styles.remove}
              aria-label={t({
                id: 'loops.remove-named',
                message: `Supprimer ${name}`
              })}
              onClick={() => onRemove(loop.id)}
            >
              ✕
            </button>
          </span>
        )
      })}
    </Cluster>
  )
}
