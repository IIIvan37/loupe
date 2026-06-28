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
  /** Open the file picker. The smart shell owns the actual import. */
  readonly onImport: () => void
  /** Reveal the keyboard-shortcuts help. The shell owns the dialog state. */
  readonly onShowShortcuts: () => void
}

/**
 * Dumb presentational header. Detected values (key/BPM/measure) are rendered in
 * teal + mono per the semantic rule (teal = what the machine detected). The
 * "Importer" button is the single import entry point; the shell wires it.
 */
export function Header({
  title,
  artist,
  detected,
  onImport,
  onShowShortcuts
}: HeaderProps) {
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
        <button
          type="button"
          className={styles.iconAction}
          aria-label="Afficher les raccourcis clavier"
          title="Raccourcis clavier"
          onClick={onShowShortcuts}
        >
          ?
        </button>
        <button
          type="button"
          className={styles.secondaryAction}
          onClick={onImport}
        >
          Importer
        </button>
        <button type="button" className={styles.primaryAction}>
          Exporter
        </button>
      </Cluster>
    </header>
  )
}
