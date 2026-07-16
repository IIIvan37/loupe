import {
  MAX_BEATS_PER_BAR,
  MAX_MANUAL_BPM,
  MIN_MANUAL_BPM,
  type OctaveFactor,
  type TempoMap,
  tempoAt
} from '@app/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { i18n } from '../../i18n/i18n.ts'
import {
  type ExternalValue,
  useExternalValue
} from '../../lib/external-value.ts'
import { CommitNumberField } from '../ui/commit-number-field.tsx'
import { LiveStatus } from '../ui/live-status.tsx'
import styles from './tempo-panel.module.css'

/** The furthest the tempo may be folded from the detection, either way. */
const MAX_OCTAVE_SHIFT = 2

// Live-region copy: the same catalog entries as the visible read-out, carried
// as descriptors so the source message doesn't ride on the JSX alone.
const STATUS_DETECTING = msg({ id: 'tempo.detecting', message: 'Analyse…' })
const STATUS_BPM = msg({ id: 'tempo.bpm', message: '{0} BPM' })

interface TempoPanelProps {
  /** The detected tempo in BPM, or undefined until detection succeeds. */
  readonly bpm: number | undefined
  /** The detected meter (beats per bar), shown beside the BPM once known. */
  readonly beatsPerBar: number | undefined
  /**
   * The tempo over time, derived from the beat grid. More than one segment
   * means the track changes tempo: the read-out then follows the playhead and
   * the whole range is shown beside it.
   */
  readonly tempoMap: TempoMap
  /** The playhead, streamed outside React state (Lot L.1). */
  readonly position: ExternalValue<number>
  /** Whether the automatic detection is in flight. */
  readonly detecting: boolean
  /** How far the tempo has been folded (±2); disables a spent direction. */
  readonly octaveShift: number
  /** Whether the tempo is a user override (typed/tapped/aligned), not detected. */
  readonly manual: boolean
  /** Fold the tempo an octave: ×2 doubles the felt tempo, ÷2 halves it. */
  readonly onFold: (factor: OctaveFactor) => void
  /**
   * Set the tempo by hand. Receives whatever the field held — including NaN
   * for an emptied field (never 0); the hook rejects non-tempos.
   */
  readonly onOverrideBpm: (bpm: number) => void
  /**
   * Correct the meter by hand (a 4/4 song detected as 6 temps). Same commit
   * contract as the BPM field: the hook rejects non-meters.
   */
  readonly onOverrideMeter: (beatsPerBar: number) => void
  /** One tap of the tap-tempo sequence. */
  readonly onTap: () => void
  /** Anchor a downbeat exactly on the given playhead instant. */
  readonly onAlignPhase: (playheadSeconds: number) => void
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
  tempoMap,
  position,
  detecting,
  octaveShift,
  manual,
  onFold,
  onOverrideBpm,
  onOverrideMeter,
  onTap,
  onAlignPhase
}: TempoPanelProps) {
  const { t } = useLingui()
  // A single segment is a steady track: show the representative bpm. With more,
  // the read-out follows the playhead and the whole range is shown beside it.
  // Subscribing to the ROUNDED felt bpm re-renders the panel only when the
  // playhead crosses a tempo segment — never per animation frame.
  const varies = tempoMap.length > 1
  const feltAt = useExternalValue(position, (seconds) => {
    const at = tempoAt(tempoMap, seconds)
    return at === undefined ? undefined : Math.round(at)
  })
  const felt = varies ? (feltAt ?? bpm) : bpm
  const min = Math.round(Math.min(...tempoMap.map((s) => s.bpm)))
  const max = Math.round(Math.max(...tempoMap.map((s) => s.bpm)))
  // What the screen reader hears. A starting detection wins over a held BPM
  // (a retry can run while the previous analysis is still seated), and the
  // representative bpm is announced rather than the playhead-following felt
  // one — a varying track would be spoken at every segment change.
  const announced = detecting
    ? i18n._(STATUS_DETECTING)
    : bpm !== undefined
      ? i18n._({ ...STATUS_BPM, values: { 0: Math.round(bpm) } })
      : undefined
  return (
    <section
      className={styles.panel}
      aria-label={t({ id: 'tempo.region-label', message: 'Tempo' })}
    >
      <span className={styles.label}>
        <Trans id="tempo.label">Tempo</Trans>
      </span>
      <LiveStatus message={announced} />
      <span className={styles.readout}>
        <CommitNumberField
          value={felt === undefined ? undefined : Math.round(felt)}
          min={MIN_MANUAL_BPM}
          max={MAX_MANUAL_BPM}
          className={styles.bpmField}
          label={t({
            id: 'tempo.bpm-field',
            message: 'Saisir le tempo (BPM)'
          })}
          // Mirrors normalizeManualBpm taken verbatim: outside the manual
          // range the hook would clamp (500 → 400) — flag instead.
          isValid={(bpm) =>
            Number.isFinite(bpm) && bpm >= MIN_MANUAL_BPM && bpm <= MAX_MANUAL_BPM
          }
          onCommit={onOverrideBpm}
        />
        <Trans id="tempo.unit">BPM</Trans>
      </span>
      {manual && (
        <span className={styles.manualBadge}>
          <Trans id="tempo.manual-badge">Manuel</Trans>
        </span>
      )}
      {varies && (
        <span className={styles.range}>
          <Trans id="tempo.range">
            {min}–{max} BPM
          </Trans>
        </span>
      )}
      {bpm !== undefined && beatsPerBar !== undefined && (
        <span className={styles.meter}>
          <CommitNumberField
            value={beatsPerBar}
            min={1}
            max={MAX_BEATS_PER_BAR}
            className={styles.meterField}
            label={t({
              id: 'tempo.meter-field',
              message: 'Saisir le mètre (temps par mesure)'
            })}
            // Mirrors overrideMeter taken verbatim: out of range it rejects
            // in silence, fractional it silently floors (4.5 → 4) — flag.
            isValid={(beats) =>
              Number.isInteger(beats) && beats >= 1 && beats <= MAX_BEATS_PER_BAR
            }
            onCommit={onOverrideMeter}
          />
          <Trans id="tempo.meter-unit">temps</Trans>
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
      <span className={styles.octave}>
        {/* The manual path stays offered with no analysis at all — it is the
            fallback when the detector fails or the server is offline. */}
        <button
          type="button"
          className={styles.octaveButton}
          onClick={onTap}
          aria-label={t({ id: 'tempo.tap', message: 'Taper le tempo' })}
        >
          <Trans id="tempo.tap-short">Tap</Trans>
        </button>
        {bpm !== undefined && (
          <button
            type="button"
            className={styles.octaveButton}
            onClick={() => onAlignPhase(position.get())}
            aria-label={t({
              id: 'tempo.align',
              message: 'Caler la grille sur la tête de lecture'
            })}
          >
            <Trans id="tempo.align-short">Caler</Trans>
          </button>
        )}
      </span>
      {/* The VISIBLE in-flight read-out lives in the analyser row (Q.2);
          this panel keeps only the polite announcement above. */}
    </section>
  )
}
