import { Cluster } from '../../layout/cluster/cluster.tsx'
import styles from './marker-controls.module.css'

interface MarkerControlsProps {
  readonly disabled: boolean
  readonly onAdd: () => void
}

/** Dumb control: drop a named marker at the current playhead. */
export function MarkerControls({ disabled, onAdd }: MarkerControlsProps) {
  return (
    <Cluster gap="var(--space-xs)" align="center">
      <span className={styles.label}>Repères</span>
      <button
        type="button"
        className={styles.add}
        disabled={disabled}
        onClick={onAdd}
      >
        + Repère
      </button>
    </Cluster>
  )
}
