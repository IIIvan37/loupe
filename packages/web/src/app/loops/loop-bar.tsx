import type { LoopLibrary, NamedLoop } from '@app/core'
import { Cluster } from '../../layout/cluster/cluster.tsx'
import styles from './loop-bar.module.css'

interface LoopBarProps {
  /** Whether an A/B region is currently selected (drag on the waveform). */
  readonly hasRegion: boolean
  readonly library: LoopLibrary
  readonly onSaveRegion: () => void
  readonly onClearRegion: () => void
  readonly onActivate: (loop: NamedLoop) => void
  readonly onRemove: (id: string) => void
}

/** Dumb bar: save/clear the current loupe selection, and recall saved loops. */
export function LoopBar({
  hasRegion,
  library,
  onSaveRegion,
  onClearRegion,
  onActivate,
  onRemove
}: LoopBarProps) {
  return (
    <Cluster gap="var(--space-xs)" align="center">
      <span className={styles.label}>Boucles</span>

      {hasRegion && (
        <>
          <button type="button" className={styles.action} onClick={onSaveRegion}>
            Enregistrer la boucle
          </button>
          <button type="button" className={styles.ghost} onClick={onClearRegion}>
            Effacer
          </button>
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
