import { Trans } from '@lingui/react/macro'
import { Cluster } from '../../layout/cluster/cluster.tsx'
import styles from './marker-controls.module.css'

interface MarkerControlsProps {
  readonly disabled: boolean
  readonly onAdd: () => void
  /** Drop a hand-laid STRUCTURE marker at the playhead (absent = not wired). */
  readonly onAddSection?: (() => void) | undefined
}

/**
 * Dumb control: drop a named marker or a hand-laid section at the playhead.
 * Detecting the sections automatically lives in the Analyse zone's action row
 * (Q.2) — this row only covers the hand gestures.
 */
export function MarkerControls({
  disabled,
  onAdd,
  onAddSection
}: MarkerControlsProps) {
  return (
    <Cluster gap="var(--space-xs)" align="center">
      <span className={styles.label}>
        <Trans id="markers.section-label">Repères</Trans>
      </span>
      <button
        type="button"
        className={styles.add}
        disabled={disabled}
        onClick={onAdd}
      >
        <Trans id="markers.add">+ Repère</Trans>
      </button>
      {onAddSection && (
        <button
          type="button"
          className={styles.add}
          disabled={disabled}
          onClick={onAddSection}
        >
          <Trans id="markers.add-section">+ Section</Trans>
        </button>
      )}
    </Cluster>
  )
}
