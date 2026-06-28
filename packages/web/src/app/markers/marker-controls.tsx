import type { MarkerKind } from '@app/core'
import { Cluster } from '../../layout/cluster/cluster.tsx'
import styles from './marker-controls.module.css'

interface MarkerControlsProps {
  readonly disabled: boolean
  readonly onAdd: (kind: MarkerKind) => void
}

const KINDS: ReadonlyArray<{ readonly kind: MarkerKind; readonly label: string }> = [
  { kind: 'section', label: 'Section' },
  { kind: 'measure', label: 'Mesure' },
  { kind: 'beat', label: 'Temps' }
]

/** Dumb control row: drop a marker of each kind at the current playhead. */
export function MarkerControls({ disabled, onAdd }: MarkerControlsProps) {
  return (
    <Cluster gap="var(--space-xs)" align="center">
      <span className={styles.label}>Repères</span>
      {KINDS.map(({ kind, label }) => (
        <button
          key={kind}
          type="button"
          className={styles.add}
          disabled={disabled}
          onClick={() => onAdd(kind)}
        >
          + {label}
        </button>
      ))}
    </Cluster>
  )
}
