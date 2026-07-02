import { MAX_GAIN_DB, MIN_GAIN_DB } from '@app/core'
import { cx } from '../../lib/cx.ts'
import { stemColor } from '../stems/stem-color.ts'
import type { MixerChannelView } from './use-mixer.ts'
import styles from './mixer-panel.module.css'

interface MixerPanelProps {
  readonly channels: readonly MixerChannelView[]
  readonly onSetGain: (id: string, gainDb: number) => void
  readonly onToggleMute: (id: string) => void
  readonly onToggleSolo: (id: string) => void
  /** Download one stem as a WAV. */
  readonly onDownloadStem: (id: string) => void
  /** Download every present stem as one zip of aligned WAVs (export tier A). */
  readonly onExportStems: () => void
}

/** Format a fader level for the mono read-out: `+3 dB`, `0 dB`, `−∞ dB`. */
function formatDb(db: number): string {
  if (db <= MIN_GAIN_DB) {
    return '−∞ dB'
  }
  const rounded = Math.round(db)
  return `${rounded > 0 ? '+' : ''}${rounded} dB`
}

/**
 * Dumb multitrack mixer: one control strip per present stem — a dB fader,
 * mute/solo toggles, the teal machine-confidence badge and a WAV export, colour-
 * matched to its waveform lane. Pure view: the flags come from the mixer hook;
 * this only renders and reports. The stems' waveforms are the lanes' job.
 */
export function MixerPanel({
  channels,
  onSetGain,
  onToggleMute,
  onToggleSolo,
  onDownloadStem,
  onExportStems
}: MixerPanelProps) {
  if (channels.length === 0) {
    return null
  }

  return (
    <section className={styles.panel} aria-label="Mixer">
      <ul className={styles.strips}>
        {channels.map(({ stem, gainDb, muted, soloed }) => (
          <li key={stem.id} className={styles.strip}>
            <span
              className={styles.swatch}
              style={{ backgroundColor: stemColor(stem.id) }}
              aria-hidden="true"
            />
            <span className={styles.label}>{stem.label}</span>
            <button
              type="button"
              className={cx(styles.toggle, muted && styles.muted)}
              aria-label={`Couper ${stem.label}`}
              aria-pressed={muted}
              onClick={() => onToggleMute(stem.id)}
            >
              M
            </button>
            <button
              type="button"
              className={cx(styles.toggle, soloed && styles.soloed)}
              aria-label={`Isoler ${stem.label}`}
              aria-pressed={soloed}
              onClick={() => onToggleSolo(stem.id)}
            >
              S
            </button>
            <input
              type="range"
              className={styles.fader}
              data-accent="amber"
              min={MIN_GAIN_DB}
              max={MAX_GAIN_DB}
              step={1}
              value={gainDb}
              aria-label={`Volume ${stem.label}`}
              onChange={(event) => onSetGain(stem.id, event.target.valueAsNumber)}
            />
            <span className={styles.db}>{formatDb(gainDb)}</span>
            <span
              className={styles.confidence}
              title={`Confiance de détection : ${Math.round(stem.confidence * 100)} %`}
            >
              {Math.round(stem.confidence * 100)} %
            </span>
            <button
              type="button"
              className={styles.download}
              aria-label={`Télécharger ${stem.label} en WAV`}
              onClick={() => onDownloadStem(stem.id)}
            >
              WAV ↓
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.export}
          onClick={onExportStems}
        >
          Exporter les stems (ZIP)
        </button>
      </div>
    </section>
  )
}
