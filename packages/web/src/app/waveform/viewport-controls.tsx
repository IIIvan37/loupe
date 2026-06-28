import { MAX_ZOOM, MIN_ZOOM, maxOffset, type Viewport } from '@app/core'
import { Cluster } from '../../layout/cluster/cluster.tsx'
import styles from './viewport-controls.module.css'

interface ViewportControlsProps {
  readonly viewport: Viewport
  /** Disabled until a track is loaded. */
  readonly disabled: boolean
  readonly onZoomIn: () => void
  readonly onZoomOut: () => void
  /** Scroll the window to an absolute offset (timeline fraction). */
  readonly onScroll: (offset: number) => void
}

/**
 * Dumb zoom + scroll control row. The zoom buttons step the magnification; the
 * range slider pans the visible window and is inert until there's something off
 * screen to reveal (zoom > 1).
 */
export function ViewportControls({
  viewport,
  disabled,
  onZoomIn,
  onZoomOut,
  onScroll
}: ViewportControlsProps) {
  const max = maxOffset(viewport)
  const canScroll = !disabled && max > 0
  // Drive the slider as a 0–1 fraction so its step is independent of the zoom.
  const fraction = max > 0 ? viewport.offset / max : 0

  return (
    <Cluster gap="var(--space-s)" align="center">
      <span className={styles.label}>Zoom</span>
      <button
        type="button"
        className={styles.zoom}
        aria-label="Dézoomer"
        disabled={disabled || viewport.zoom <= MIN_ZOOM}
        onClick={onZoomOut}
      >
        −
      </button>
      <span className={styles.level}>{Math.round(viewport.zoom)}×</span>
      <button
        type="button"
        className={styles.zoom}
        aria-label="Zoomer"
        disabled={disabled || viewport.zoom >= MAX_ZOOM}
        onClick={onZoomIn}
      >
        +
      </button>
      <input
        type="range"
        className={styles.scroll}
        min={0}
        max={1}
        step={0.01}
        value={fraction}
        aria-label="Défilement horizontal"
        disabled={!canScroll}
        onChange={(event) => onScroll(event.target.valueAsNumber * max)}
      />
    </Cluster>
  )
}
