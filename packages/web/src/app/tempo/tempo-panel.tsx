import { Trans, useLingui } from '@lingui/react/macro'
import styles from './tempo-panel.module.css'

interface TempoPanelProps {
  /** The detected tempo in BPM, or undefined until a run succeeds. */
  readonly bpm: number | undefined
  /** Whether a detection is in flight. */
  readonly detecting: boolean
  /** Why the last detection failed, if it did. */
  readonly error: string | undefined
  /** Whether a track is loaded and its PCM is ready to analyse. */
  readonly canDetect: boolean
  readonly onDetect: () => void
}

/**
 * Dumb presentational panel for tempo detection: a single action on the loaded
 * track that, once the server answers, reads out the BPM (the beat grid it also
 * produces is drawn on the waveform). Acts on the audio already in the player —
 * no second import.
 */
export function TempoPanel({
  bpm,
  detecting,
  error,
  canDetect,
  onDetect
}: TempoPanelProps) {
  const { t } = useLingui()
  return (
    <section
      className={styles.panel}
      aria-label={t({ id: 'tempo.region-label', message: 'Tempo' })}
    >
      <span className={styles.label}>
        <Trans id="tempo.label">Tempo</Trans>
      </span>
      {bpm !== undefined && (
        <span className={styles.readout}>
          <Trans id="tempo.bpm">{Math.round(bpm)} BPM</Trans>
        </span>
      )}
      <button
        type="button"
        className={styles.action}
        disabled={!canDetect || detecting}
        onClick={onDetect}
      >
        {detecting ? (
          <Trans id="tempo.detecting">Analyse…</Trans>
        ) : bpm === undefined ? (
          <Trans id="tempo.detect">Détecter le tempo</Trans>
        ) : (
          <Trans id="tempo.redetect">Recalculer</Trans>
        )}
      </button>
      {error !== undefined && (
        <span role="alert" className={styles.error}>
          {error}
        </span>
      )}
    </section>
  )
}
