import { formatTimecode, type MarkerList } from '@app/core'
import styles from './marker-rail.module.css'

interface MarkerRailProps {
  readonly markers: MarkerList
  readonly durationSeconds: number
  /** Jump to a marker's time (its section tag). */
  readonly onSeek: (timeSeconds: number) => void
}

// The ruler shows nine evenly-spaced timecodes (eighths of the track).
const RULER_TICKS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const

/**
 * Dumb timeline: a timecode ruler with the user's named markers pinned along it.
 * Markers are amber — your settings, per the token rule. Each shows a labelled
 * tag; click it to seek.
 */
export function MarkerRail({
  markers,
  durationSeconds,
  onSeek
}: MarkerRailProps) {
  if (durationSeconds <= 0) {
    return <div className={styles.timeline} aria-hidden="true" />
  }
  return (
    <div className={styles.timeline}>
      <div className={styles.ruler}>
        {RULER_TICKS.map((tick) => (
          <span key={tick} className={styles.tick}>
            {formatTimecode((durationSeconds * tick) / 8)}
          </span>
        ))}
      </div>
      <div className={styles.markers}>
        {markers.map((marker) => (
          <span
            key={marker.id}
            className={styles.marker}
            style={{ left: `${(marker.timeSeconds / durationSeconds) * 100}%` }}
          >
            <span className={styles.pin} aria-hidden="true" />
            <button
              type="button"
              className={styles.tag}
              aria-label={`Aller à ${marker.label}`}
              onClick={() => onSeek(marker.timeSeconds)}
            >
              {marker.label}
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}
