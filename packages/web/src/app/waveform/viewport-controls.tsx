import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from '@app/core'
import styles from './viewport-controls.module.css'

interface ViewportControlsProps {
  /** Current magnification, 1× … 6×. */
  readonly zoom: number
  /** Disabled until a track is loaded. */
  readonly disabled: boolean
  readonly onZoomIn: () => void
  readonly onZoomOut: () => void
  /** Set an absolute zoom level (the slider). */
  readonly onSetZoom: (zoom: number) => void
}

/** Format the zoom level like the prototype: `1×`, `2.5×`. */
function formatZoom(zoom: number): string {
  return `${Number.isInteger(zoom) ? zoom : zoom.toFixed(1)}×`
}

/**
 * Dumb zoom pill, overlaid top-right of the waveform. The slider sets the
 * magnification (it zooms — it does not pan); − / + step it. Panning is the
 * waveform's own horizontal scroll.
 */
export function ViewportControls({
  zoom,
  disabled,
  onZoomIn,
  onZoomOut,
  onSetZoom
}: ViewportControlsProps) {
  return (
    <div className={styles.tools}>
      <span className={styles.level}>{formatZoom(zoom)}</span>
      <button
        type="button"
        className={styles.tick}
        aria-label="Dézoomer"
        disabled={disabled || zoom <= MIN_ZOOM}
        onClick={onZoomOut}
      >
        −
      </button>
      <input
        type="range"
        className={styles.slider}
        data-accent="amber"
        min={MIN_ZOOM}
        max={MAX_ZOOM}
        step={ZOOM_STEP}
        value={zoom}
        aria-label="Zoom de la forme d'onde"
        disabled={disabled}
        onChange={(event) => onSetZoom(event.target.valueAsNumber)}
      />
      <button
        type="button"
        className={styles.tick}
        aria-label="Zoomer"
        disabled={disabled || zoom >= MAX_ZOOM}
        onClick={onZoomIn}
      >
        +
      </button>
    </div>
  )
}
