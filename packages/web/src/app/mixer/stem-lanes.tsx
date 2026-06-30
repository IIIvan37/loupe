import { stemColorVar } from '../stems/stem-color.ts'
import { WaveformCanvas } from '../waveform/waveform-canvas.tsx'
import type { MixerChannelView } from './use-mixer.ts'
import styles from './stem-lanes.module.css'

interface StemLanesProps {
  readonly channels: readonly MixerChannelView[]
}

/**
 * The per-stem waveform lanes, one under another, meant to sit inside the
 * `ZoomStage` so they share the main view's zoom, scroll and playhead. Each lane
 * is read-only (the transport drives them all): the stem's envelope in its
 * reserved colour, paling with the channel's effective level so muting/soloing
 * is legible at a glance. Pure view — levels and waveforms come from the mixer.
 */
export function StemLanes({ channels }: StemLanesProps) {
  if (channels.length === 0) {
    return null
  }

  return (
    <ul className={styles.lanes}>
      {channels.map(({ stem, level }) => (
        <li
          key={stem.id}
          className={styles.lane}
          // Never fully gone, so a muted stem stays legible.
          style={{ opacity: 0.15 + 0.85 * level }}
        >
          <span className={styles.label}>{stem.label}</span>
          <WaveformCanvas
            waveform={stem.track.waveform}
            colorVar={stemColorVar(stem.id)}
            label={`Forme d'onde de ${stem.label}`}
          />
        </li>
      ))}
    </ul>
  )
}
