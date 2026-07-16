import {
  formatTimecode,
  MAX_FINE_TUNE_CENTS,
  MAX_TEMPO_PERCENT,
  MIN_FINE_TUNE_CENTS,
  MIN_TEMPO_PERCENT
} from '@app/core'
import { Trans, useLingui } from '@lingui/react/macro'
import { Cluster } from '../../layout/cluster/cluster.tsx'
import { CommitNumberField } from '../ui/commit-number-field.tsx'
import { cx } from '../../lib/cx.ts'
import {
  type ExternalValue,
  useExternalValue
} from '../../lib/external-value.ts'
import { Icon } from '../ui/icon.tsx'
import { signedSemitones } from '../ui/signed-semitones.ts'
import styles from './transport-bar.module.css'

interface TransportBarProps {
  /** The playhead, streamed outside React state (Lot L.1). */
  readonly position: ExternalValue<number>
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
  /** Fine pitch adjustment in cents (±50), separate from the semitones. */
  readonly fineTuneCents: number
  readonly onFineTuneChange: (cents: number) => void
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
  onPitchChange,
  fineTuneCents,
  onFineTuneChange
}: TransportBarProps) {
  const { t } = useLingui()
  // Subscribing to the FORMATTED timecode re-renders the bar once per elapsed
  // second — the 60 Hz playhead never reaches React through this prop.
  const timecode = useExternalValue(position, formatTimecode)
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
          <span className={styles.position}>{timecode}</span>
          <span className={styles.separator}> / </span>
          <span className={styles.duration}>{duration}</span>
        </span>
      </Cluster>

      <Cluster gap="var(--space-l)" align="center">
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            {/* « Vitesse », not « Tempo » (Q.5): « Tempo » is reserved for
                the panel's musical BPM — two same-named read-outs used to
                measure two different quantities. */}
            <Trans id="transport.tempo-label">Vitesse (sans toucher au pitch)</Trans>
          </span>
          <input
            type="range"
            data-accent="amber"
            min={MIN_TEMPO_PERCENT}
            max={MAX_TEMPO_PERCENT}
            value={tempoPercent}
            aria-label={t({
              id: 'transport.tempo-slider',
              message: 'Vitesse en pourcentage'
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
            {signedSemitones(pitchSemitones)}
          </span>
        </label>
        {/* The last cents to the right key: a 30-cents-sharp recording (old
            pressing, sped-up tape) is untranscribable on whole semitones.
            Separate knob — never part of the chart's transposition. */}
        {/* Not a <label>: the input lives inside CommitNumberField and
            carries its own aria-label — the visible caption is decorative. */}
        <div className={styles.field}>
          <span className={styles.fieldLabel} aria-hidden="true">
            <Trans id="transport.fine-tune-label">Ajustement fin</Trans>
          </span>
          <CommitNumberField
            value={fineTuneCents}
            min={MIN_FINE_TUNE_CENTS}
            max={MAX_FINE_TUNE_CENTS}
            className={styles.fineTuneField}
            disabled={!canPlay}
            label={t({
              id: 'transport.fine-tune-field',
              message: "Saisir l'ajustement fin (cents)"
            })}
            isValid={(cents) =>
              Number.isInteger(cents) &&
              cents >= MIN_FINE_TUNE_CENTS &&
              cents <= MAX_FINE_TUNE_CENTS
            }
            onCommit={onFineTuneChange}
          />
          <span className={styles.fieldValue}>
            <Trans id="transport.fine-tune-unit">cents</Trans>
          </span>
        </div>
      </Cluster>
    </footer>
  )
}
