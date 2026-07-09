import { MAX_TEMPO_PERCENT, MIN_TEMPO_PERCENT } from '@app/core'
import { Trans, useLingui } from '@lingui/react/macro'
import { Cluster } from '../../layout/cluster/cluster.tsx'
import { cx } from '../../lib/cx.ts'
import { Icon } from '../ui/icon.tsx'
import styles from './transport-bar.module.css'

interface TransportBarProps {
  readonly position: string
  readonly duration: string
  readonly isPlaying: boolean
  /** Disabled until a track is loaded. */
  readonly canPlay: boolean
  readonly onPlayPause: () => void
  /** Jump the playhead to the start / end of the timeline. */
  readonly onSeekToStart: () => void
  readonly onSeekToEnd: () => void
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
  onSeekToStart,
  onSeekToEnd,
  tempoPercent,
  pitchSemitones,
  onTempoChange,
  onPitchChange
}: TransportBarProps) {
  const { t } = useLingui()
  return (
    <footer className={styles.bar}>
      <Cluster gap="var(--space-s)" align="center">
        <button
          type="button"
          className={styles.control}
          aria-label={t({ id: 'transport.start', message: 'Début' })}
          disabled={!canPlay}
          onClick={onSeekToStart}
        >
          <Icon name="skip-back" />
        </button>
        <button
          type="button"
          className={cx(styles.control, styles.play)}
          data-on-amber=""
          aria-label={
            isPlaying
              ? t({ id: 'transport.pause', message: 'Pause' })
              : t({ id: 'transport.play', message: 'Lecture' })
          }
          aria-pressed={isPlaying}
          disabled={!canPlay}
          onClick={onPlayPause}
        >
          <Icon name={isPlaying ? 'pause' : 'play'} />
        </button>
        <button
          type="button"
          className={styles.control}
          aria-label={t({ id: 'transport.end', message: 'Fin' })}
          disabled={!canPlay}
          onClick={onSeekToEnd}
        >
          <Icon name="skip-forward" />
        </button>
        <span className={styles.time}>
          <span className={styles.position}>{position}</span>
          <span className={styles.separator}> / </span>
          <span className={styles.duration}>{duration}</span>
        </span>
      </Cluster>

      <Cluster gap="var(--space-l)" align="center">
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            <Trans id="transport.tempo-label">Tempo (sans toucher au pitch)</Trans>
          </span>
          <input
            type="range"
            data-accent="amber"
            min={MIN_TEMPO_PERCENT}
            max={MAX_TEMPO_PERCENT}
            value={tempoPercent}
            aria-label={t({
              id: 'transport.tempo-slider',
              message: 'Tempo en pourcentage'
            })}
            disabled={!canPlay}
            title={t({
              id: 'transport.tempo-reset',
              message: 'Double-clic pour revenir à 100 %'
            })}
            onChange={(event) => onTempoChange(event.target.valueAsNumber)}
            onDoubleClick={() => onTempoChange(100)}
          />
          <span className={styles.fieldValue}>{tempoPercent} %</span>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            <Trans id="transport.pitch-label">Hauteur</Trans>
          </span>
          <input
            type="range"
            data-accent="amber"
            min={-12}
            max={12}
            value={pitchSemitones}
            aria-label={t({
              id: 'transport.pitch-slider',
              message: 'Hauteur en demi-tons'
            })}
            disabled={!canPlay}
            title={t({
              id: 'transport.pitch-reset',
              message: 'Double-clic pour revenir à 0'
            })}
            onChange={(event) => onPitchChange(event.target.valueAsNumber)}
            onDoubleClick={() => onPitchChange(0)}
          />
          <span className={styles.fieldValue}>
            {pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones}
          </span>
        </label>
      </Cluster>
    </footer>
  )
}
