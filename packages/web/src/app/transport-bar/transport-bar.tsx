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
  /** Tempo as a percentage of normal speed (100 = original). */
  readonly tempoPercent: number
  /** Pitch shift in whole semitones (0 = original key). */
  readonly pitchSemitones: number
  readonly onTempoChange: (percent: number) => void
  readonly onPitchChange: (semitones: number) => void
}

/**
 * Dumb presentational transport bar. Play/pause and the tempo/pitch sliders are
 * wired (Slices 2–3); active/playing affordances use amber per the semantic rule.
 */
export function TransportBar({
  position,
  duration,
  isPlaying,
  canPlay,
  onPlayPause,
  tempoPercent,
  pitchSemitones,
  onTempoChange,
  onPitchChange
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
            data-accent="amber"
            min={50}
            max={150}
            value={tempoPercent}
            aria-label="Tempo en pourcentage"
            disabled={!canPlay}
            onChange={(event) => onTempoChange(event.target.valueAsNumber)}
          />
          <span className={styles.fieldValue}>{tempoPercent} %</span>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Hauteur</span>
          <input
            type="range"
            data-accent="teal"
            min={-12}
            max={12}
            value={pitchSemitones}
            aria-label="Hauteur en demi-tons"
            disabled={!canPlay}
            onChange={(event) => onPitchChange(event.target.valueAsNumber)}
          />
          <span className={styles.fieldValue}>
            {pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones}
          </span>
        </label>
      </Cluster>
    </footer>
  )
}
