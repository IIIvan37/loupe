import { useLingui } from '@lingui/react/macro'
import { type PointerEvent, useRef, useState } from 'react'
import { clamp01 } from '../../lib/clamp01.ts'
import { pointerRatio } from '../../lib/pointer-ratio.ts'
import { stemColorVar } from '../stems/stem-color.ts'
import { WaveformCanvas } from '../waveform/waveform-canvas.tsx'
import type { MixerChannelView } from './use-mixer.ts'
import styles from './stem-lanes.module.css'

interface StemLanesProps {
  readonly channels: readonly MixerChannelView[]
  /** Seek the transport to a 0–1 fraction of the whole timeline. */
  readonly onSeekRatio: (ratio: number) => void
  readonly durationSeconds: number
}

/**
 * The per-stem waveform lanes, one under another, meant to sit inside the
 * `ZoomStage` so they share the main view's zoom, scroll and playhead. Each
 * lane's envelope is read-only (the transport drives them all): the stem's
 * colour, paling with the channel's effective level so muting/soloing is
 * legible at a glance. Naming and controls live in the gutter's `StemHeaders`,
 * row-aligned by the shared `--stem-lane-*` tokens.
 *
 * A single pointer surface spans every lane: a click anywhere on the stems
 * cales the transport, and one hover cursor tracks the pointer across all
 * lanes at once — the same idiom as the main waveform, so any layer of the
 * view is a place to seek. Deliberately NOT a button: like the waveform
 * surface it is pointer-only (no Enter action to promise; the keyboard path is
 * the transport shortcuts).
 */
export function StemLanes({
  channels,
  onSeekRatio,
  durationSeconds
}: StemLanesProps) {
  const { t } = useLingui()
  const surfaceRef = useRef<HTMLDivElement>(null)
  // The pointer's position over the stems while hovering — a single cursor
  // line spanning every lane. Cleared when the pointer leaves.
  const [hoverRatio, setHoverRatio] = useState<number | null>(null)

  if (channels.length === 0) {
    return null
  }

  function ratioAt(clientX: number): number | null {
    return pointerRatio(surfaceRef.current?.getBoundingClientRect(), clientX)
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) {
      return
    }
    const ratio = ratioAt(event.clientX)
    if (ratio !== null) {
      onSeekRatio(ratio)
    }
  }

  return (
    <div className={styles.group}>
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
      <div
        ref={surfaceRef}
        className={styles.surface}
        data-testid="stem-lanes-surface"
        onPointerUp={onPointerUp}
        onPointerMove={(event) => setHoverRatio(ratioAt(event.clientX))}
        onPointerLeave={() => setHoverRatio(null)}
      />
      {hoverRatio !== null && durationSeconds > 0 && (
        <span
          className={styles.hover}
          style={{ left: `${clamp01(hoverRatio) * 100}%` }}
          aria-hidden="true"
          data-testid="stem-lanes-hover"
        />
      )}
    </div>
  )
}
