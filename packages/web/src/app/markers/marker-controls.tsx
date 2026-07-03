import { Trans } from '@lingui/react/macro'
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
    </Cluster>
  )
}
