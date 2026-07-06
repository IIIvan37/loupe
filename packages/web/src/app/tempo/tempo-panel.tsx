import type { OctaveFactor } from '@app/core'
import { Trans, useLingui } from '@lingui/react/macro'
import styles from './tempo-panel.module.css'

/** The furthest the tempo may be folded from the detection, either way. */
const MAX_OCTAVE_SHIFT = 2

interface TempoPanelProps {
  /** The detected tempo in BPM, or undefined until detection succeeds. */
  readonly bpm: number | undefined
  /** The detected meter (beats per bar), shown beside the BPM once known. */
  readonly beatsPerBar: number | undefined
  /** Whether the automatic detection is in flight. */
  readonly detecting: boolean
  /** Why the last detection failed, if it did. */
  readonly error: string | undefined
  /** How far the tempo has been folded (±2); disables a spent direction. */
  readonly octaveShift: number
  /** Fold the tempo an octave: ×2 doubles the felt tempo, ÷2 halves it. */
  readonly onFold: (factor: OctaveFactor) => void
}

/**
 * Dumb read-out of the automatic tempo detection: the BPM once the server
 * answers (the beat grid it also produces is drawn on the waveform, and the
 * metronome click stem is seated in the mixer). Detection runs on its own the
 * moment a track loads. The ×2 / ÷2 buttons correct an octave error (a common
 * detector mistake) by folding the felt tempo, up to ±2 octaves.
 */
export function TempoPanel({
  bpm,
  beatsPerBar,
  detecting,
  error,
  octaveShift,
  onFold
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
      {bpm !== undefined && beatsPerBar !== undefined && (
        <span className={styles.meter}>
          <Trans id="tempo.meter">{beatsPerBar} temps</Trans>
        </span>
      )}
      {bpm !== undefined && (
        <span className={styles.octave}>
          <button
            type="button"
            className={styles.octaveButton}
            onClick={() => onFold(0.5)}
            disabled={octaveShift <= -MAX_OCTAVE_SHIFT}
            aria-label={t({
              id: 'tempo.halve',
              message: 'Diviser le tempo par deux'
            })}
          >
            ÷2
          </button>
          <button
            type="button"
            className={styles.octaveButton}
            onClick={() => onFold(2)}
            disabled={octaveShift >= MAX_OCTAVE_SHIFT}
            aria-label={t({
              id: 'tempo.double',
              message: 'Doubler le tempo'
            })}
          >
            ×2
          </button>
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
