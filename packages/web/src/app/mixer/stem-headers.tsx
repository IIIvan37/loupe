import { MAX_GAIN_DB, MIN_GAIN_DB } from '@app/core'
import { useLingui } from '@lingui/react/macro'
import { cx } from '../../lib/cx.ts'
import { stemColor } from '../stems/stem-color.ts'
import type { MixerChannelView } from './use-mixer.ts'
import styles from './stem-headers.module.css'

interface StemHeadersProps {
  readonly channels: readonly MixerChannelView[]
  readonly onSetGain: (id: string, gainDb: number) => void
  readonly onToggleMute: (id: string) => void
  readonly onToggleSolo: (id: string) => void
  /** Download one stem as a WAV. */
  readonly onDownloadStem: (id: string) => void
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
 * Dumb DAW-style track headers for the `ZoomStage` gutter: one compact header
 * per present stem — name (machine confidence as its tooltip), WAV export,
 * mute/solo and a dB fader — colour-matched to, and row-aligned with, its
 * waveform lane (shared `--stem-lane-*` tokens). Pure view: the flags come
 * from the mixer hook; this only renders and reports.
 */
export function StemHeaders({
  channels,
  onSetGain,
  onToggleMute,
  onToggleSolo,
  onDownloadStem
}: StemHeadersProps) {
  const { t } = useLingui()
  if (channels.length === 0) {
    return null
  }

  return (
    <ul
      className={styles.headers}
      aria-label={t({ id: 'mixer.region-label', message: 'Mixer' })}
    >
      {channels.map(({ stem, gainDb, muted, soloed }) => {
        // Bound locally so the ICU placeholders keep readable names.
        const name = stem.label
        const percent = Math.round(stem.confidence * 100)
        return (
          <li key={stem.id} className={styles.header}>
            <div className={styles.identity}>
              <span
                className={styles.swatch}
                style={{ backgroundColor: stemColor(stem.id) }}
                aria-hidden="true"
              />
              <span
                className={styles.label}
                title={t({
                  id: 'mixer.confidence',
                  message: `Confiance de détection : ${percent} %`
                })}
              >
                {stem.label}
              </span>
              <button
                type="button"
                className={styles.download}
                aria-label={t({
                  id: 'mixer.download-wav',
                  message: `Télécharger ${name} en WAV`
                })}
                onClick={() => onDownloadStem(stem.id)}
              >
                WAV ↓
              </button>
            </div>
            <div className={styles.controls}>
              <button
                type="button"
                className={cx(styles.toggle, muted && styles.muted)}
                aria-label={t({ id: 'mixer.mute', message: `Couper ${name}` })}
                aria-pressed={muted}
                onClick={() => onToggleMute(stem.id)}
              >
                M
              </button>
              <button
                type="button"
                className={cx(styles.toggle, soloed && styles.soloed)}
                aria-label={t({ id: 'mixer.solo', message: `Isoler ${name}` })}
                aria-pressed={soloed}
                onClick={() => onToggleSolo(stem.id)}
              >
                S
              </button>
              <input
                type="range"
                className={styles.fader}
                data-accent="amber"
                data-compact=""
                min={MIN_GAIN_DB}
                max={MAX_GAIN_DB}
                step={1}
                value={gainDb}
                aria-label={t({
                  id: 'mixer.volume',
                  message: `Volume ${name}`
                })}
                onChange={(event) =>
                  onSetGain(stem.id, event.target.valueAsNumber)
                }
              />
              <span className={styles.db}>{formatDb(gainDb)}</span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
