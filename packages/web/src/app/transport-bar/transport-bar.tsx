import { Cluster } from '../../layout/cluster/cluster.tsx'
import { cx } from '../../lib/cx.ts'
import styles from './transport-bar.module.css'

interface TransportBarProps {
  readonly position: string
  readonly duration: string
  readonly isPlaying: boolean
  /** Disabled until a track is loaded. */
  readonly canPlay: boolean
  readonly onPlayPause: () => void
}

/**
 * Dumb presentational transport bar. Play/pause is wired (Slice 2); the tempo and
 * pitch sliders stay disabled until Slice 3. Active/playing affordances use amber
 * per the semantic rule.
 */
export function TransportBar({
  position,
  duration,
  isPlaying,
  canPlay,
  onPlayPause
}: TransportBarProps) {
  return (
    <footer className={styles.bar}>
      <Cluster gap="var(--space-s)" align="center">
        <button type="button" className={styles.control} aria-label="Début" disabled>
          ⏮
        </button>
        <button
          type="button"
          className={cx(styles.control, styles.play)}
          aria-label={isPlaying ? 'Pause' : 'Lecture'}
          aria-pressed={isPlaying}
          disabled={!canPlay}
          onClick={onPlayPause}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button type="button" className={styles.control} aria-label="Fin" disabled>
          ⏭
        </button>
        <button type="button" className={styles.control} aria-label="Boucle" disabled>
          ⟳
        </button>
        <span className={styles.time}>
          <span className={styles.position}>{position}</span>
          <span className={styles.separator}> / </span>
          <span className={styles.duration}>{duration}</span>
        </span>
      </Cluster>

      <Cluster gap="var(--space-l)" align="center">
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Tempo (sans toucher au pitch)</span>
          <input
            type="range"
            min={50}
            max={150}
            defaultValue={100}
            aria-label="Tempo en pourcentage"
            disabled
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Hauteur</span>
          <input
            type="range"
            min={-12}
            max={12}
            defaultValue={0}
            aria-label="Hauteur en demi-tons"
            disabled
          />
        </label>
      </Cluster>
    </footer>
  )
}
