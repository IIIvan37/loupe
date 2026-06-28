import type { LoopRegion } from '@app/core'
import { type PointerEvent, useRef } from 'react'
import type { ImportState } from './use-player.ts'
import { WaveformCanvas } from './waveform-canvas.tsx'
import styles from './waveform-view.module.css'

interface WaveformViewProps {
  readonly state: ImportState
  /** The active loop, for the « loupe » dim overlay. */
  readonly loopRegion: LoopRegion | undefined
  readonly durationSeconds: number
  /** Click (no drag) seeks to a fraction (0–1) of the timeline. */
  readonly onSeek: (ratio: number) => void
  /** A drag selects an A/B region, given as start/end fractions (0–1). */
  readonly onSelectRegion: (startRatio: number, endRatio: number) => void
}

// Below this drag distance (fraction of the width) a press counts as a click.
const DRAG_THRESHOLD = 0.005

/**
 * Dumb presentational view of the import state: a prompt while idle, progress
 * while decoding, an alert on failure, and — once loaded — the amber waveform
 * with click-to-seek, drag-to-select (the « loupe »), and a dim overlay outside
 * the active loop. It fills its `ZoomStage` layer, so its 0–1 coordinates are
 * whole-timeline ratios at any zoom; the playhead and scrolling are the stage's.
 */
export function WaveformView({
  state,
  loopRegion,
  durationSeconds,
  onSeek,
  onSelectRegion
}: WaveformViewProps) {
  const dragStartRef = useRef<number | null>(null)

  function onPointerDown(event: PointerEvent<HTMLButtonElement>): void {
    if (event.button !== 0) {
      return
    }
    dragStartRef.current = ratioAt(event)
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>): void {
    const start = dragStartRef.current
    dragStartRef.current = null
    const end = ratioAt(event)
    if (start === null || end === null) {
      return
    }
    if (Math.abs(end - start) < DRAG_THRESHOLD) {
      onSeek(end)
    } else {
      onSelectRegion(Math.min(start, end), Math.max(start, end))
    }
  }

  switch (state.status) {
    case 'idle':
      return (
        <p className={styles.hint}>
          Importe un fichier audio pour afficher sa forme d'onde.
        </p>
      )
    case 'loading':
      return <p className={styles.hint}>Décodage…</p>
    case 'error':
      return (
        <p role="alert" className={styles.error}>
          {state.message}
        </p>
      )
    case 'loaded': {
      const loop = loopRatios(loopRegion, durationSeconds)
      return (
        <button
          type="button"
          className={styles.surface}
          aria-label="Forme d'onde : clic pour se positionner, glisser pour boucler"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          <WaveformCanvas
            waveform={state.track.waveform}
            label="Forme d'onde de la piste"
          />
          {loop && (
            <>
              <span
                className={styles.dim}
                style={{ left: 0, width: `${loop.start * 100}%` }}
                aria-hidden="true"
              />
              <span
                className={styles.dim}
                style={{ left: `${loop.end * 100}%`, right: 0 }}
                aria-hidden="true"
              />
            </>
          )}
        </button>
      )
    }
  }
}

/** The pointer's position along the (full-timeline) surface as 0–1, or null. */
function ratioAt(event: PointerEvent<HTMLButtonElement>): number | null {
  const rect = event.currentTarget.getBoundingClientRect()
  if (rect.width <= 0) {
    return null
  }
  return clamp01((event.clientX - rect.left) / rect.width)
}

/** Convert the loop region into start/end fractions, or undefined if not usable. */
function loopRatios(
  region: LoopRegion | undefined,
  durationSeconds: number
): { readonly start: number; readonly end: number } | undefined {
  if (!region || durationSeconds <= 0) {
    return undefined
  }
  return {
    start: clamp01(region.startSeconds / durationSeconds),
    end: clamp01(region.endSeconds / durationSeconds)
  }
}

function clamp01(ratio: number): number {
  if (Number.isNaN(ratio) || ratio < 0) {
    return 0
  }
  return Math.min(ratio, 1)
}
