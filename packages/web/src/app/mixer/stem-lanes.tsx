import { useLingui } from '@lingui/react/macro'
import { stemColorVar } from '../stems/stem-color.ts'
import { WaveformCanvas } from '../waveform/waveform-canvas.tsx'
import type { MixerChannelView } from './use-mixer.ts'
import styles from './stem-lanes.module.css'

interface StemLanesProps {
  readonly channels: readonly MixerChannelView[]
}

/**
 * The per-stem waveform lanes, one under another, meant to sit inside the
 * `ZoomStage` so they share the main view's zoom, scroll and playhead. Each
 * lane is read-only (the transport drives them all): the stem's envelope in
 * its reserved colour, paling with the channel's effective level so muting/
 * soloing is legible at a glance. Naming and controls live in the gutter's
 * `StemHeaders`, row-aligned by the shared `--stem-lane-*` tokens. Pure view —
 * levels and waveforms come from the mixer.
 */
export function StemLanes({ channels }: StemLanesProps) {
  const { t } = useLingui()
  if (channels.length === 0) {
    return null
  }

  return (
    <ul className={styles.lanes}>
      {channels.map(({ stem, level }) => {
        // Bound locally so the ICU placeholder keeps a readable name.
        const name = stem.label
        return (
          <li key={stem.id} className={styles.lane}>
            <div
              className={styles.wave}
              // Fade only the envelope — never fully gone, so a muted stem's
              // lane still reads against its header in the gutter.
              style={{ opacity: 0.15 + 0.85 * level }}
            >
              <WaveformCanvas
                waveform={stem.track.waveform}
                colorVar={stemColorVar(stem.id)}
                label={t({
                  id: 'waveform.stem-image',
                  message: `Forme d'onde de ${name}`
                })}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
