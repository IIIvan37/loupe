import { type StemFilter } from '@app/core'
import { Popover } from '@base-ui-components/react/popover'
import { useLingui } from '@lingui/react/macro'
import { cx } from '../../lib/cx.ts'
import { stemColor } from '../stems/stem-color.ts'
import { Icon } from '../ui/icon.tsx'
import { GainFader } from './gain-fader.tsx'
import type { MixerChannelView } from './use-mixer.ts'
import styles from './stem-headers.module.css'

interface StemHeadersProps {
  readonly channels: readonly MixerChannelView[]
  readonly onSetGain: (id: string, gainDb: number) => void
  /** Shape one stem's tone (low/high-cut) — session-only. */
  readonly onSetFilter: (id: string, filter: StemFilter) => void
  readonly onToggleMute: (id: string) => void
  readonly onToggleSolo: (id: string) => void
  /** Download one stem as a WAV. */
  readonly onDownloadStem: (id: string) => void
}

/**
 * Dumb DAW-style track headers for the `ZoomStage` gutter: one compact header
 * per present stem — name (machine confidence as its tooltip), WAV export,
 * mute/solo and a dB fader — colour-matched to, and row-aligned with, its
 * waveform lane (shared `--stem-lane-*` tokens). Pure view: the flags come
 * from the mixer hook; this only renders and reports.
 */
/** Slider edges meaning « that side off » (the neutral biquad park). */
const LOW_CUT_OFF_HZ = 20
const HIGH_CUT_OFF_HZ = 20000

/** The filter both sliders describe — an edge-parked side is omitted. */
function stemFilter(
  lowCutHz: number | undefined,
  highCutHz: number | undefined
): StemFilter {
  return {
    ...(lowCutHz === undefined || lowCutHz <= LOW_CUT_OFF_HZ
      ? {}
      : { lowCutHz }),
    ...(highCutHz === undefined || highCutHz >= HIGH_CUT_OFF_HZ
      ? {}
      : { highCutHz })
  }
}

export function StemHeaders({
  onSetFilter,
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
      {channels.map(({ stem, gainDb, muted, soloed, filter }) => {
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
                WAV <Icon name="download" className={styles.downloadIcon} />
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
              <GainFader
                stemId={stem.id}
                name={name}
                gainDb={gainDb}
                onSetGain={onSetGain}
              />
              {/* Tone shaping lives behind a popover (Y.1): the header keeps
                  its two 48px-contract lines, the EQ opens on demand.
                  Session-only: a listening aid, never saved with the
                  project. A slider parked at its edge is « that side off »
                  — the DAW convention for an EQ at rest. */}
              <Popover.Root>
                <Popover.Trigger
                  className={cx(styles.toggle)}
                  aria-label={t({
                    id: 'mixer.eq',
                    message: `Égaliseur ${name}`
                  })}
                  // Visible mark that this stem is being shaped even while
                  // the popover is closed.
                  {...(filter.lowCutHz !== undefined ||
                  filter.highCutHz !== undefined
                    ? { 'data-filtered': '' }
                    : {})}
                >
                  EQ
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner
                    className={cx(styles.eqPositioner)}
                    sideOffset={6}
                  >
                    <Popover.Popup className={cx(styles.eqPopup)}>
                      <Popover.Title className={cx(styles.eqTitle)}>
                        {t({ id: 'mixer.eq-title', message: `EQ — ${name}` })}
                      </Popover.Title>
                      <div className={styles.filters}>
                        <span className={styles.filterTag} aria-hidden="true">
                          LC
                        </span>
                        <input
                          type="range"
                          className={styles.filterSlider}
                          data-accent="amber"
                          data-compact=""
                          min={LOW_CUT_OFF_HZ}
                          max={2000}
                          step={10}
                          value={filter.lowCutHz ?? LOW_CUT_OFF_HZ}
                          aria-label={t({
                            id: 'mixer.low-cut',
                            message: `Coupe-bas ${name}`
                          })}
                          title={t({
                            id: 'mixer.low-cut-hint',
                            message: 'Couper les graves sous cette fréquence'
                          })}
                          onChange={(event) =>
                            onSetFilter(
                              stem.id,
                              stemFilter(
                                event.target.valueAsNumber,
                                filter.highCutHz
                              )
                            )
                          }
                        />
                        <span className={styles.filterTag} aria-hidden="true">
                          HC
                        </span>
                        <input
                          type="range"
                          className={styles.filterSlider}
                          data-accent="amber"
                          data-compact=""
                          min={200}
                          max={HIGH_CUT_OFF_HZ}
                          step={100}
                          value={filter.highCutHz ?? HIGH_CUT_OFF_HZ}
                          aria-label={t({
                            id: 'mixer.high-cut',
                            message: `Coupe-haut ${name}`
                          })}
                          title={t({
                            id: 'mixer.high-cut-hint',
                            message:
                              'Couper les aigus au-dessus de cette fréquence'
                          })}
                          onChange={(event) =>
                            onSetFilter(
                              stem.id,
                              stemFilter(
                                filter.lowCutHz,
                                event.target.valueAsNumber
                              )
                            )
                          }
                        />
                      </div>
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
