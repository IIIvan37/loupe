import { MAX_GAIN_DB, MIN_GAIN_DB, stepGainDb, UNITY_GAIN_DB } from '@app/core'
import { useLingui } from '@lingui/react/macro'
import { type KeyboardEvent, useEffect, useRef } from 'react'
import { useLatest } from '../../lib/use-latest.ts'
import { CommitNumberField } from '../ui/commit-number-field.tsx'
import styles from './stem-headers.module.css'

/** Which way each arrow key nudges the fader (louder up/right, quieter down/left). */
const ARROW_DIRECTION: Record<string, -1 | 1 | undefined> = {
  ArrowUp: 1,
  ArrowRight: 1,
  ArrowDown: -1,
  ArrowLeft: -1
}

interface GainFaderProps {
  readonly stemId: string
  readonly name: string
  readonly gainDb: number
  readonly onSetGain: (id: string, gainDb: number) => void
}

/**
 * One channel's volume fader: a dB range slider with an editable dB read-out.
 * Coarse control stays the drag and plain arrow keys (1 dB, the native step);
 * the wheel and Shift-arrows nudge the fine 0.5 dB grain (`stepGainDb`),
 * double-click returns to unity (0 dB), and the read-out can be typed for an
 * exact level. Pure view — every change is reported through `onSetGain`.
 */
export function GainFader({ stemId, name, gainDb, onSetGain }: GainFaderProps) {
  const { t } = useLingui()
  const sliderRef = useRef<HTMLInputElement>(null)
  // The wheel handler fires after commit and must read the live level and
  // callback without re-subscribing on every notch — the latest-ref idiom.
  const gainRef = useLatest(gainDb)
  const onSetGainRef = useLatest(onSetGain)

  // The wheel tunes the fine 0.5 dB step. React registers `wheel` passively at
  // the root, so a React `onWheel` can't `preventDefault` — bind a non-passive
  // native listener once so tuning the fader never scrolls the gutter underneath.
  useEffect(() => {
    const slider = sliderRef.current
    if (!slider) {
      return
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      onSetGainRef.current(
        stemId,
        stepGainDb(gainRef.current, event.deltaY < 0 ? 1 : -1)
      )
    }
    slider.addEventListener('wheel', onWheel, { passive: false })
    return () => slider.removeEventListener('wheel', onWheel)
  }, [stemId, gainRef, onSetGainRef])

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    // Shift + arrow escapes the native 1 dB step for the fine 0.5 dB one; a
    // plain arrow keeps the slider's own whole-dB movement.
    if (!event.shiftKey) {
      return
    }
    const direction = ARROW_DIRECTION[event.key]
    if (direction === undefined) {
      return
    }
    event.preventDefault()
    onSetGain(stemId, stepGainDb(gainDb, direction))
  }

  return (
    <>
      <input
        ref={sliderRef}
        type="range"
        className={styles.fader}
        data-accent="amber"
        data-compact=""
        min={MIN_GAIN_DB}
        max={MAX_GAIN_DB}
        step={1}
        value={gainDb}
        aria-label={t({ id: 'mixer.volume', message: `Volume ${name}` })}
        // Double-click returns to unity (0 dB) — the shared « retour neutre »
        // gesture (AL.3/AM.2), matching the transport sliders.
        title={t({
          id: 'mixer.volume-reset',
          message: 'Double-clic pour revenir à 0 dB'
        })}
        onChange={(event) => onSetGain(stemId, event.target.valueAsNumber)}
        onDoubleClick={() => onSetGain(stemId, UNITY_GAIN_DB)}
        onKeyDown={onKeyDown}
      />
      <span className={styles.dbField}>
        <CommitNumberField
          value={gainDb}
          min={MIN_GAIN_DB}
          max={MAX_GAIN_DB}
          className={styles.db}
          label={t({
            id: 'mixer.volume-db',
            message: `Niveau de ${name} en décibels`
          })}
          // The reducer takes any in-range level verbatim; out of range it
          // clamps, so flag those as a draft while typing.
          isValid={(db) => db >= MIN_GAIN_DB && db <= MAX_GAIN_DB}
          onCommit={(db) => onSetGain(stemId, db)}
        />
        <span className={styles.dbUnit} aria-hidden="true">
          dB
        </span>
      </span>
    </>
  )
}
