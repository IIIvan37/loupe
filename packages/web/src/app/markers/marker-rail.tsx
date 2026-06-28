import { formatTimecode, type MarkerList } from '@app/core'
import { cx } from '../../lib/cx.ts'
import styles from './marker-rail.module.css'

interface MarkerRailProps {
  readonly markers: MarkerList
  readonly durationSeconds: number
  /** Jump to a marker's time. */
  readonly onSeek: (timeSeconds: number) => void
  readonly onRemove: (id: string) => void
}

// The ruler shows nine evenly-spaced timecodes (eighths of the track).
const RULER_TICKS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const

/**
 * Dumb timeline: a timecode ruler with section/measure/beat markers pinned along
 * it (matching the prototype). Markers are amber — your settings, per the token
 * rule. A section shows a labelled tag (click to seek, ✕ to remove); finer
 * measure/beat markers are pins only.
 */
export function MarkerRail({
  markers,
  durationSeconds,
  onSeek,
  onRemove
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
            <span
              className={cx(styles.pin, styles[marker.kind])}
              aria-hidden="true"
            />
            {marker.kind === 'section' && (
              <>
                <button
                  type="button"
                  className={styles.tag}
                  aria-label={`Aller à ${marker.label}`}
                  onClick={() => onSeek(marker.timeSeconds)}
                >
                  {marker.label}
                </button>
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Supprimer ${marker.label}`}
                  onClick={() => onRemove(marker.id)}
                >
                  ✕
                </button>
              </>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}
