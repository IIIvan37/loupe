import {
  formatTimecode,
  MAX_FINE_TUNE_CENTS,
  MAX_PITCH_SEMITONES,
  MAX_TEMPO_PERCENT,
  MIN_FINE_TUNE_CENTS,
  MIN_PITCH_SEMITONES,
  MIN_TEMPO_PERCENT,
  stepPitchSemitones,
  stepTempoPercent
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
import { StepperField } from './stepper-field.tsx'
import styles from './transport-bar.module.css'
// signedSemitones dropped here: the pitch read-out is now an editable field.

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
        {/* « Vitesse », not « Tempo » (Q.5): « Tempo » is reserved for the
            panel's musical BPM. The « sans toucher au pitch » precision lives
            in the slider tooltip (AE.3) — a caption must not document itself. */}
        <StepperField
          label={<Trans id="transport.tempo-label">Vitesse</Trans>}
          value={tempoPercent}
          min={MIN_TEMPO_PERCENT}
          max={MAX_TEMPO_PERCENT}
          disabled={!canPlay}
          sliderLabel={t({
            id: 'transport.tempo-slider',
            message: 'Vitesse en pourcentage'
          })}
          sliderTitle={t({
            id: 'transport.tempo-reset',
            message:
              'Vitesse sans toucher au pitch — double-clic pour revenir à 100 %'
          })}
          fieldLabel={t({
            id: 'transport.tempo-field',
            message: 'Saisir la vitesse (pourcentage)'
          })}
          stepDownLabel={t({
            id: 'transport.tempo-down',
            message: 'Ralentir la lecture'
          })}
          stepUpLabel={t({
            id: 'transport.tempo-up',
            message: 'Accélérer la lecture'
          })}
          unit="%"
          neutral={100}
          isValid={(percent) =>
            Number.isInteger(percent) &&
            percent >= MIN_TEMPO_PERCENT &&
            percent <= MAX_TEMPO_PERCENT
          }
          onSetValue={onTempoChange}
          onStep={(direction) =>
            onTempoChange(stepTempoPercent(tempoPercent, direction))
          }
        />
        <StepperField
          label={<Trans id="transport.pitch-label">Hauteur</Trans>}
          value={pitchSemitones}
          min={MIN_PITCH_SEMITONES}
          max={MAX_PITCH_SEMITONES}
          disabled={!canPlay}
          sliderLabel={t({
            id: 'transport.pitch-slider',
            message: 'Hauteur en demi-tons'
          })}
          sliderTitle={t({
            id: 'transport.pitch-reset',
            message: 'Double-clic pour revenir à 0'
          })}
          fieldLabel={t({
            id: 'transport.pitch-field',
            message: 'Saisir la hauteur (demi-tons)'
          })}
          stepDownLabel={t({
            id: 'transport.pitch-down',
            message: 'Baisser la hauteur d’un demi-ton'
          })}
          stepUpLabel={t({
            id: 'transport.pitch-up',
            message: 'Monter la hauteur d’un demi-ton'
          })}
          neutral={0}
          isValid={(semitones) =>
            Number.isInteger(semitones) &&
            semitones >= MIN_PITCH_SEMITONES &&
            semitones <= MAX_PITCH_SEMITONES
          }
          onSetValue={onPitchChange}
          onStep={(direction) =>
            onPitchChange(stepPitchSemitones(pitchSemitones, direction))
          }
        />
        {/* The last cents to the right key: a 30-cents-sharp recording (old
            pressing, sped-up tape) is untranscribable on whole semitones.
            Separate knob — never part of the chart's transposition. */}
        {/* Not a <label>: the input lives inside CommitNumberField and
            carries its own aria-label — the visible caption is decorative. */}
        <div className={styles.field}>
          <span className={styles.fieldLabel} aria-hidden="true">
            <Trans id="transport.fine-tune-label">Ajustement fin</Trans>
          </span>
          {/* Input and unit on one line (AE.2): a third storey under the
              label made this field ~70px tall — the whole footer's height. */}
          <span className={styles.fineTuneRow}>
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
          </span>
        </div>
      </Cluster>
    </footer>
  )
}
