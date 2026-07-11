import { type ReactNode, useEffect, useRef } from 'react'
import { clamp01 } from '../../lib/clamp01.ts'
import type { ExternalValue } from '../../lib/external-value.ts'
import styles from './zoom-stage.module.css'

interface ZoomStageProps {
  /** Current magnification (1× … 6×); widens the scrollable inner. */
  readonly zoom: number
  /** The playhead in seconds, streamed outside React state (Lot L.1). */
  readonly position: ExternalValue<number>
  readonly durationSeconds: number
  /** The aligned layers — ruler/markers, waveform, stem lanes — share this space. */
  readonly children: ReactNode
}

/**
 * Dumb horizontally-scrollable stage shared by every timeline-aligned layer
 * (ruler, markers, waveform, stem lanes). Zoom widens the inner so all layers
 * scale and scroll together — keeping timecodes and markers lined up with the
 * waveform at any zoom. Owns the playhead spanning all layers and the
 * auto-scroll that follows it during playback. The fixed track-header gutter
 * beside it is the shell's composition.
 */
export function ZoomStage({
  zoom,
  position,
  durationSeconds,
  children
}: ZoomStageProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLSpanElement>(null)

  // The playhead is driven imperatively off the position store: a frame tick
  // moves this one DOM node (and the zoomed scroll) — no React re-render, the
  // whole point of Lot L.1. Runs once on mount/zoom/duration change so the
  // cursor is right before the first tick too. This is a store SUBSCRIPTION
  // (external-system sync), not event logic — react-doctor's no-event-handler
  // is a false positive here, suppressed for this file in doctor.config.json.
  useEffect(() => {
    const apply = () => {
      const ratio =
        durationSeconds > 0 ? position.get() / durationSeconds : 0
      const playhead = playheadRef.current
      if (playhead) {
        playhead.style.left = `${clamp01(ratio) * 100}%`
      }
      // Keep the playhead in view through a zoomed-in timeline — on playback
      // and on a seek (paused included). Centres it; at 1× nothing scrolls.
      const scroll = scrollRef.current
      if (scroll && zoom > 1) {
        const centred = ratio * scroll.scrollWidth - scroll.clientWidth / 2
        scroll.scrollLeft = Math.max(0, centred)
      }
    }
    apply()
    return position.subscribe(apply)
  }, [position, zoom, durationSeconds])

  return (
    <div ref={scrollRef} className={styles.scroll}>
      <div className={styles.inner} style={{ width: `${zoom * 100}%` }}>
        {children}
        <span
          ref={playheadRef}
          className={styles.playhead}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
