import type { MarkerList } from '@app/core'
import { cx } from '../../lib/cx.ts'
import styles from './marker-rail.module.css'

interface MarkerRailProps {
  readonly markers: MarkerList
  readonly durationSeconds: number
  /** Jump to a marker's time. */
  readonly onSeek: (timeSeconds: number) => void
  readonly onRemove: (id: string) => void
}

/**
 * Dumb timeline rail: places each marker at its fraction of the duration. Markers
 * are amber (your settings, per the token rule), weighted by kind — sections are
 * labelled, measures medium, beats faint. Click a marker to seek, ✕ to remove.
 */
export function MarkerRail({
  markers,
  durationSeconds,
  onSeek,
  onRemove
}: MarkerRailProps) {
  return (
    <div className={styles.rail}>
      {durationSeconds > 0 &&
        markers.map((marker) => (
          <span
            key={marker.id}
            className={styles.marker}
            style={{ left: `${(marker.timeSeconds / durationSeconds) * 100}%` }}
          >
            <button
              type="button"
              className={cx(styles.flag, styles[marker.kind])}
              aria-label={`Aller à ${marker.label}`}
              onClick={() => onSeek(marker.timeSeconds)}
            >
              {marker.kind === 'section' && (
                <span className={styles.text}>{marker.label}</span>
              )}
            </button>
            <button
              type="button"
              className={styles.remove}
              aria-label={`Supprimer ${marker.label}`}
              onClick={() => onRemove(marker.id)}
            >
              ✕
            </button>
          </span>
        ))}
    </div>
  )
}
