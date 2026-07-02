import { formatTimecode, type Marker, type MarkerList } from '@app/core'
import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react'
import { clamp01 } from '../../lib/clamp01.ts'
import styles from './marker-rail.module.css'

interface MarkerRailProps {
  readonly markers: MarkerList
  readonly durationSeconds: number
  /** Jump to a marker's time (its section tag). */
  readonly onSeek: (timeSeconds: number) => void
  /** Drop a dragged (or arrow-nudged) marker at a new time. */
  readonly onMove: (id: string, timeSeconds: number) => void
}

// The ruler shows nine evenly-spaced timecodes (eighths of the track).
const RULER_TICKS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const

// Below this drag distance (fraction of the width) a press counts as a click.
const DRAG_THRESHOLD = 0.005
// Keyboard step for nudging a marker with the arrow keys.
const NUDGE_RATIO = 0.01

/** The in-progress tag drag, or null when idle. */
interface Drag {
  readonly id: string
  readonly anchor: number
  readonly current: number
}

/**
 * Dumb timeline: a timecode ruler with the user's named markers pinned along it.
 * Markers are amber — your settings, per the token rule. Each shows a labelled
 * tag: click it to seek, drag it (or nudge with ←/→) to move the marker. It fills
 * its `ZoomStage` layer, so its 0–1 coordinates are whole-timeline ratios at any
 * zoom.
 */
export function MarkerRail({
  markers,
  durationSeconds,
  onSeek,
  onMove
}: MarkerRailProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)

  /** The pointer's position along the rail as a 0–1 ratio, or null. */
  function ratioFrom(clientX: number): number | null {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) {
      return null
    }
    return clamp01((clientX - rect.left) / rect.width)
  }

  function beginDrag(event: PointerEvent<HTMLButtonElement>, id: string): void {
    if (event.button !== 0) {
      return
    }
    // An unmeasurable rail (zero width) still arms the press so a plain click
    // seeks: anchor and current stay equal until a real move measures a ratio.
    const ratio = ratioFrom(event.clientX) ?? 0
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({ id, anchor: ratio, current: ratio })
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>): void {
    const ratio = ratioFrom(event.clientX)
    if (ratio === null) {
      return
    }
    setDrag((current) => (current ? { ...current, current: ratio } : current))
  }

  function endDrag(
    event: PointerEvent<HTMLButtonElement>,
    marker: Marker
  ): void {
    const finished = drag
    setDrag(null)
    if (!finished) {
      return
    }
    const ratio = ratioFrom(event.clientX) ?? finished.current
    if (Math.abs(ratio - finished.anchor) < DRAG_THRESHOLD) {
      onSeek(marker.timeSeconds)
      return
    }
    onMove(finished.id, ratio * durationSeconds)
  }

  function onTagKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    marker: Marker
  ): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return
    }
    event.preventDefault()
    const delta = event.key === 'ArrowLeft' ? -NUDGE_RATIO : NUDGE_RATIO
    const ratio = clamp01(marker.timeSeconds / durationSeconds + delta)
    onMove(marker.id, ratio * durationSeconds)
  }

  if (durationSeconds <= 0) {
    return <div className={styles.timeline} aria-hidden="true" />
  }
  return (
    <div ref={containerRef} className={styles.timeline}>
      <div className={styles.ruler}>
        {RULER_TICKS.map((tick) => (
          <span key={tick} className={styles.tick}>
            {formatTimecode((durationSeconds * tick) / 8)}
          </span>
        ))}
      </div>
      <div className={styles.markers}>
        {markers.map((marker) => {
          // The dragged tag previews live; the others follow committed state.
          const ratio =
            drag?.id === marker.id
              ? drag.current
              : marker.timeSeconds / durationSeconds
          return (
            <span
              key={marker.id}
              className={styles.marker}
              style={{ left: `${ratio * 100}%` }}
            >
              <span className={styles.pin} aria-hidden="true" />
              <button
                type="button"
                className={styles.tag}
                aria-label={`Aller à ${marker.label}`}
                title="Clic : se positionner — glisser ou ←/→ : déplacer"
                onPointerDown={(event) => beginDrag(event, marker.id)}
                onPointerMove={onPointerMove}
                onPointerUp={(event) => endDrag(event, marker)}
                onKeyDown={(event) => onTagKeyDown(event, marker)}
              >
                {marker.label}
              </button>
            </span>
          )
        })}
      </div>
    </div>
  )
}
