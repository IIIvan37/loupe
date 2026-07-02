import { type ReactNode, useEffect, useRef } from 'react'
import { clamp01 } from '../../lib/clamp01.ts'
import styles from './zoom-stage.module.css'

interface ZoomStageProps {
  /** Current magnification (1× … 6×); widens the scrollable inner. */
  readonly zoom: number
  /** Playhead position as a fraction (0–1) of the timeline. */
  readonly positionRatio: number
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
export function ZoomStage({ zoom, positionRatio, children }: ZoomStageProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Sync the scroll to the playhead so it stays in view through a zoomed-in
  // timeline — on playback and on a seek (paused included). Centres the playhead;
  // at zoom 1 there's nothing to scroll.
  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll || zoom <= 1) {
      return
    }
    const centred = positionRatio * scroll.scrollWidth - scroll.clientWidth / 2
    scroll.scrollLeft = Math.max(0, centred)
  }, [positionRatio, zoom])

  return (
    <div ref={scrollRef} className={styles.scroll}>
      <div className={styles.inner} style={{ width: `${zoom * 100}%` }}>
        {children}
        <span
          className={styles.playhead}
          style={{ left: `${clamp01(positionRatio) * 100}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
