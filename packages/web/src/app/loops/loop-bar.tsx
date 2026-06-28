import type { LoopLibrary, LoopRegion, NamedLoop } from '@app/core'
import { Cluster } from '../../layout/cluster/cluster.tsx'
import { cx } from '../../lib/cx.ts'
import { NameEditor } from '../ui/name-editor.tsx'
import styles from './loop-bar.module.css'

interface LoopBarProps {
  /** The active A/B region (drag on the waveform), or undefined when none. */
  readonly region: LoopRegion | undefined
  /** Whether the active region already belongs to a saved loop. */
  readonly isSaved: boolean
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
  loopEnabled,
  onToggleLoop,
  library,
  onSaveRegion,
  onUpdateLoop,
  onClearRegion,
  onActivate,
  onRemove
}: LoopBarProps) {
  return (
    <Cluster gap="var(--space-xs)" align="center">
      <span className={styles.label}>Boucles</span>

      {region && (
        <>
          <button
            type="button"
            className={cx(styles.toggle, loopEnabled && styles.toggleOn)}
            aria-pressed={loopEnabled}
            onClick={onToggleLoop}
          >
            {loopEnabled ? '⟳ Boucle active' : '⟳ Boucle inactive'}
          </button>
          {!isSaved && (
            <>
              <NameEditor
                title="Enregistrer la boucle"
                triggerClassName={cx(styles.action)}
                triggerLabel="Enregistrer la boucle"
                triggerContent="Enregistrer la boucle"
                submitLabel="Enregistrer"
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
                Effacer
              </button>
            </>
          )}
        </>
      )}

      {library.map((loop) => (
        <span key={loop.id} className={styles.saved}>
          <button
            type="button"
            className={styles.recall}
            onClick={() => onActivate(loop)}
          >
            {loop.name}
          </button>
          <NameEditor
            title="Renommer la boucle"
            triggerClassName={cx(styles.edit)}
            triggerLabel={`Renommer ${loop.name}`}
            triggerContent="✎"
            submitLabel="Renommer"
            initialName={loop.name}
            onSubmit={(name) => onUpdateLoop({ ...loop, name })}
          />
          <button
            type="button"
            className={styles.remove}
            aria-label={`Supprimer ${loop.name}`}
            onClick={() => onRemove(loop.id)}
          >
            ✕
          </button>
        </span>
      ))}
    </Cluster>
  )
}
