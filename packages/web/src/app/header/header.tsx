import { Cluster } from '../../layout/cluster/cluster.tsx'
import { cx } from '../../lib/cx.ts'
import { NameEditor } from '../ui/name-editor.tsx'
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
  /** Save the session as a named project. The shell owns the actual save. */
  readonly onSaveProject?: (name: string) => void
  /** The current project's name, seeding the save popover. */
  readonly saveName?: string
  /** Whether there is anything to save (a track is loaded). */
  readonly canSave?: boolean
  /** Reveal the saved-projects dialog. The shell owns its state. */
  readonly onShowProjects?: () => void
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
  onShowShortcuts,
  onSaveProject,
  saveName,
  canSave,
  onShowProjects
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
          className={styles.primaryAction}
          data-on-amber=""
          onClick={onImport}
        >
          Importer
        </button>
        <button
          type="button"
          className={styles.secondaryAction}
          disabled
          title="Bientôt — export des stems (jalon export)"
        >
          Exporter
        </button>
        {onSaveProject &&
          (canSave ? (
            <NameEditor
              title="Enregistrer le projet"
              triggerClassName={cx(styles.secondaryAction)}
              triggerLabel="Enregistrer le projet"
              triggerContent="Enregistrer"
              submitLabel="Enregistrer"
              initialName={saveName ?? ''}
              onSubmit={onSaveProject}
            />
          ) : (
            <button
              type="button"
              className={styles.secondaryAction}
              disabled
              title="Importe un morceau pour pouvoir l'enregistrer"
            >
              Enregistrer
            </button>
          ))}
        {onShowProjects && (
          <button
            type="button"
            className={styles.secondaryAction}
            onClick={onShowProjects}
          >
            Projets
          </button>
        )}
      </Cluster>
    </header>
  )
}
