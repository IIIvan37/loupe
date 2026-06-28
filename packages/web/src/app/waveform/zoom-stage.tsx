import { type ReactNode, useEffect, useRef } from 'react'
import { clamp01 } from '../../lib/clamp01.ts'
import { ViewportControls } from './viewport-controls.tsx'
import styles from './zoom-stage.module.css'

interface ZoomStageProps {
  /** Current magnification (1× … 6×); widens the scrollable inner. */
  readonly zoom: number
  /** Playhead position as a fraction (0–1) of the timeline. */
  readonly positionRatio: number
  /** Disables the zoom pill until a track is loaded. */
  readonly disabled: boolean
  readonly onZoomIn: () => void
  readonly onZoomOut: () => void
  readonly onSetZoom: (zoom: number) => void
  /** The aligned layers — ruler/markers and the waveform — share this space. */
  readonly children: ReactNode
}

/**
 * Dumb horizontally-scrollable stage shared by every timeline-aligned layer
 * (ruler, markers, waveform). Zoom widens the inner so all layers scale and
 * scroll together — keeping timecodes and markers lined up with the waveform at
 * any zoom. Owns the zoom pill, the playhead spanning all layers, and the
 * auto-scroll that follows the playhead during playback.
 */
export function ZoomStage({
  zoom,
  positionRatio,
  disabled,
  onZoomIn,
  onZoomOut,
  onSetZoom,
  children
}: ZoomStageProps) {
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
    <div className={styles.stage}>
      <ViewportControls
        zoom={zoom}
        disabled={disabled}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onSetZoom={onSetZoom}
      />
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
    </div>
  )
}
