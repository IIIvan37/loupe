import {
  type LoopRegion,
  sliceWaveform,
  toTimelineRatio,
  toViewRatio,
  type Viewport,
  type Waveform,
  visibleWindow
} from '@app/core'
import { type PointerEvent, useMemo, useRef, type WheelEvent } from 'react'
import type { ImportState } from './use-player.ts'
import { WaveformCanvas } from './waveform-canvas.tsx'
import styles from './waveform-view.module.css'

interface WaveformViewProps {
  readonly state: ImportState
  /** Playhead position as a fraction (0–1) of the timeline. */
  readonly positionRatio: number
  /** The active loop, for the « loupe » dim overlay. */
  readonly loopRegion: LoopRegion | undefined
  readonly durationSeconds: number
  /** The zoom + scroll window the surface is rendered through. */
  readonly viewport: Viewport
  /** Click (no drag) seeks to a fraction (0–1) of the timeline. */
  readonly onSeek: (ratio: number) => void
  /** A drag selects an A/B region, given as start/end fractions (0–1). */
  readonly onSelectRegion: (startRatio: number, endRatio: number) => void
  /** Wheel/trackpad pans the window by a timeline-fraction delta. */
  readonly onScrollBy: (deltaRatio: number) => void
}

// Below this drag distance (fraction of the width) a press counts as a click.
const DRAG_THRESHOLD = 0.005

const EMPTY_WAVEFORM: Waveform = { peaks: [] }

/**
 * Dumb presentational view of the import state: a prompt while idle, progress
 * while decoding, an alert on failure, and — once loaded — the amber waveform
 * (re-rendered through the zoom/scroll `viewport`) with a playhead, click-to-seek,
 * drag-to-select (the « loupe »), wheel-to-pan, and a dim overlay outside the
 * active loop. All pointer maths happens in the surface's local 0–1 space and is
 * mapped to/from timeline ratios through the viewport.
 */
export function WaveformView({
  state,
  positionRatio,
  loopRegion,
  durationSeconds,
  viewport,
  onSeek,
  onSelectRegion,
  onScrollBy
}: WaveformViewProps) {
  const dragStartRef = useRef<number | null>(null)

  // Re-slice the peaks only when the track or the visible window changes — not on
  // every playback tick — so the canvas keeps a stable reference and won't repaint.
  const { start: windowStart, end: windowEnd } = visibleWindow(viewport)
  const loadedWaveform =
    state.status === 'loaded' ? state.track.waveform : EMPTY_WAVEFORM
  const visibleWaveform = useMemo(
    () => sliceWaveform(loadedWaveform, windowStart, windowEnd),
    [loadedWaveform, windowStart, windowEnd]
  )

  function onPointerDown(event: PointerEvent<HTMLButtonElement>): void {
    if (event.button !== 0) {
      return
    }
    dragStartRef.current = viewRatioAt(event)
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>): void {
    const start = dragStartRef.current
    dragStartRef.current = null
    const end = viewRatioAt(event)
    if (start === null || end === null) {
      return
    }
    if (Math.abs(end - start) < DRAG_THRESHOLD) {
      onSeek(clamp01(toTimelineRatio(viewport, end)))
    } else {
      const a = clamp01(toTimelineRatio(viewport, Math.min(start, end)))
      const b = clamp01(toTimelineRatio(viewport, Math.max(start, end)))
      onSelectRegion(a, b)
    }
  }

  function onWheel(event: WheelEvent<HTMLButtonElement>): void {
    // Only horizontal intent pans (trackpad swipe / shift-wheel); a plain
    // vertical wheel is left to scroll the page. The surface shows a 1/zoom-wide
    // window, so a pixel delta scaled by the view spans that window.
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.deltaX === 0 || rect.width <= 0) {
      return
    }
    onScrollBy(event.deltaX / rect.width / viewport.zoom)
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
      const loop = loopViewRatios(loopRegion, durationSeconds, viewport)
      const playhead = toViewRatio(viewport, positionRatio)
      return (
        <button
          type="button"
          className={styles.stage}
          aria-label="Forme d'onde : clic pour se positionner, glisser pour boucler"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
        >
          <WaveformCanvas
            waveform={visibleWaveform}
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
          {playhead >= 0 && playhead <= 1 && (
            <span
              className={styles.playhead}
              style={{ left: `${playhead * 100}%` }}
              aria-hidden="true"
            />
          )}
        </button>
      )
    }
  }
}

/** The pointer's position along the surface as a fraction (0–1), or null. */
function viewRatioAt(event: PointerEvent<HTMLButtonElement>): number | null {
  const rect = event.currentTarget.getBoundingClientRect()
  if (rect.width <= 0) {
    return null
  }
  return clamp01((event.clientX - rect.left) / rect.width)
}

/**
 * The loop's edges as surface (0–1) fractions through the viewport, clamped to
 * the visible window, or undefined if the region isn't usable.
 */
function loopViewRatios(
  region: LoopRegion | undefined,
  durationSeconds: number,
  viewport: Viewport
): { readonly start: number; readonly end: number } | undefined {
  if (!region || durationSeconds <= 0) {
    return undefined
  }
  return {
    start: clamp01(toViewRatio(viewport, region.startSeconds / durationSeconds)),
    end: clamp01(toViewRatio(viewport, region.endSeconds / durationSeconds))
  }
}

function clamp01(ratio: number): number {
  if (Number.isNaN(ratio) || ratio < 0) {
    return 0
  }
  return Math.min(ratio, 1)
}
