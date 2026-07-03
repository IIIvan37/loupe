import { Trans, useLingui } from '@lingui/react/macro'
import styles from './tempo-panel.module.css'

interface TempoPanelProps {
  /** The detected tempo in BPM, or undefined until detection succeeds. */
  readonly bpm: number | undefined
  /** Whether the automatic detection is in flight. */
  readonly detecting: boolean
  /** Why the last detection failed, if it did. */
  readonly error: string | undefined
}

/**
 * Dumb read-out of the automatic tempo detection: the BPM once the server
 * answers (the beat grid it also produces is drawn on the waveform, and the
 * metronome click stem is seated in the mixer). Detection runs on its own the
 * moment a track loads — there is no button.
 */
export function TempoPanel({ bpm, detecting, error }: TempoPanelProps) {
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
      {bpm === undefined && detecting && (
        <span className={styles.readout}>
          <Trans id="tempo.detecting">Analyse…</Trans>
        </span>
      )}
      {error !== undefined && (
        <span role="alert" className={styles.error}>
          {error}
        </span>
      )}
    </section>
  )
}
