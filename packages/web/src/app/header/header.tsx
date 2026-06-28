import { Cluster } from '../../layout/cluster/cluster.tsx'
import styles from './header.module.css'

interface DetectedReadout {
  readonly id: string
  readonly label: string
  readonly value: string
}

interface HeaderProps {
  readonly title: string
  readonly artist: string
  readonly detected: readonly DetectedReadout[]
}

/**
 * Dumb presentational header. Detected values (key/BPM/measure) are rendered in
 * teal + mono per the semantic rule (teal = what the machine detected).
 */
export function Header({ title, artist, detected }: HeaderProps) {
  return (
    <header className={styles.header}>
      <Cluster gap="var(--space-l)" align="center">
        <span className={styles.logo}>Loupe</span>
        <div className={styles.track}>
          <p className={styles.title}>{title}</p>
          <p className={styles.artist}>{artist}</p>
        </div>
      </Cluster>

      <Cluster gap="var(--space-s)" align="center">
        {detected.map((item) => (
          <span key={item.id} className={styles.readout}>
            <span className={styles.readoutLabel}>{item.label}</span>
            <span className={styles.readoutValue}>{item.value}</span>
          </span>
        ))}
        <button type="button" className={styles.secondaryAction}>
          Importer
        </button>
        <button type="button" className={styles.primaryAction}>
          Exporter
        </button>
      </Cluster>
    </header>
  )
}
