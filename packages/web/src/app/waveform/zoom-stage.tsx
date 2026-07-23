import { type ReactNode, useEffect, useRef } from 'react'
import { clamp01 } from '../../lib/clamp01.ts'
import type { ExternalValue } from '../../lib/external-value.ts'
import { followScrollLeft } from './follow-scroll.ts'
import styles from './zoom-stage.module.css'

/** How long a manual scroll keeps the auto-follow suspended. */
const MANUAL_SCROLL_GRACE_MS = 2000

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
  const innerRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLSpanElement>(null)
  // Epoch until which the auto-follow stays suspended after a manual scroll.
  const followSuspendedUntilRef = useRef(0)
  // The scrollLeft the follow itself last applied (read back after the write,
  // so browser clamping/rounding can't desync it) — its own scroll event must
  // not count as a manual scroll and suspend the follow.
  const followedScrollLeftRef = useRef<number | null>(null)

  // A manual scroll (wheel, scrollbar, touch) hands the window back to the
  // user: the follow stays off for a grace period, then resumes.
  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) {
      return
    }
    const onScroll = () => {
      // Sub-pixel tolerance against fractional scroll positions.
      const followed = followedScrollLeftRef.current
      if (followed !== null && Math.abs(scroll.scrollLeft - followed) < 1) {
        return
      }
      followSuspendedUntilRef.current = Date.now() + MANUAL_SCROLL_GRACE_MS
    }
    scroll.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scroll.removeEventListener('scroll', onScroll)
    }
  }, [])

  // The playhead is driven imperatively off the position store: a frame tick
  // moves this one DOM node — no React re-render, the whole point of Lot L.1.
  // Runs once on mount/zoom/duration change so the cursor is right before the
  // first tick too. This is a store SUBSCRIPTION (external-system sync), not
  // event logic — react-doctor's no-event-handler is a false positive here,
  // suppressed for this file in doctor.config.json.
  useEffect(() => {
    const apply = () => {
      const ratio = clamp01(
        durationSeconds > 0 ? position.get() / durationSeconds : 0
      )
      // Geometry reads come BEFORE any style write: reading layout after a
      // write would force a synchronous reflow on every frame.
      // DAW page-follow (Lot L.2): scroll only when the playhead leaves the
      // visible window — not every frame — and never right after a manual
      // scroll. At 1× nothing scrolls.
      const scroll = scrollRef.current
      const next =
        scroll && zoom > 1 && Date.now() >= followSuspendedUntilRef.current
          ? followScrollLeft({
              playheadX: ratio * scroll.scrollWidth,
              scrollLeft: scroll.scrollLeft,
              clientWidth: scroll.clientWidth,
              scrollWidth: scroll.scrollWidth
            })
          : null
      const playhead = playheadRef.current
      if (playhead && scroll) {
        // Transform, not `left` (V.4): a per-frame `left` write invalidates
        // layout on every tick; translateX stays compositor-only.
        playhead.style.transform = `translateX(${ratio * scroll.scrollWidth}px)`
      }
      // The played fraction, published for the colour-split layers (AO.1):
      // the vivid « lu » copy clips on this variable — clip-path is paint-only,
      // so the per-frame write never re-renders React nor invalidates layout.
      innerRef.current?.style.setProperty('--playhead-ratio', String(ratio))
      if (scroll && next !== null) {
        scroll.scrollLeft = next
        followedScrollLeftRef.current = scroll.scrollLeft
      }
    }
    apply()
    const unsubscribe = position.subscribe(apply)
    // Pixel transforms go stale when the stage rewidens without a position
    // tick (window resize while paused) — `left: %` tracked that for free.
    const scroll = scrollRef.current
    const observer =
      scroll && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(apply)
        : null
    if (scroll && observer) {
      observer.observe(scroll)
    }
    return () => {
      unsubscribe()
      observer?.disconnect()
    }
  }, [position, zoom, durationSeconds])

  return (
    <div ref={scrollRef} className={styles.scroll}>
      <div
        ref={innerRef}
        className={styles.inner}
        style={{ width: `${zoom * 100}%` }}
      >
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
