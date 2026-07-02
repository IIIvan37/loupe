import { Cluster } from '../../layout/cluster/cluster.tsx'
import { cx } from '../../lib/cx.ts'
import { NameEditor } from '../ui/name-editor.tsx'
import styles from './header.module.css'

interface DetectedReadout {
  readonly id: string
  readonly label: string
  readonly value: string
}

/** The header's server read-out: a coloured dot plus a short label. */
export interface ServerStatus {
  readonly tone: 'offline' | 'degraded' | 'ready'
  readonly label: string
}

interface HeaderProps {
  readonly title: string
  readonly artist: string
  readonly detected: readonly DetectedReadout[]
  /** The local server's health, or undefined while still probing. */
  readonly serverStatus?: ServerStatus | undefined
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
  /** Whether the session maps to a saved project — a re-save is one click. */
  readonly hasProject?: boolean
  /** Whether a save is in flight — the save controls lock while it runs. */
  readonly saving?: boolean
  /** Reveal the saved-projects dialog. The shell owns its state. */
  readonly onShowProjects?: () => void
}

interface SaveControlsProps {
  readonly onSaveProject: (name: string) => void
  readonly saveName: string
  readonly canSave: boolean
  readonly hasProject: boolean
  readonly saving: boolean
}

/**
 * The save affordances: disabled before a track loads, a name popover for the
 * first save, then — once a project exists — a one-click re-save under the
 * same name plus a « Renommer… » popover to save under a new one.
 */
function SaveControls({
  onSaveProject,
  saveName,
  canSave,
  hasProject,
  saving
}: SaveControlsProps) {
  if (!canSave) {
    return (
      <button
        type="button"
        className={styles.secondaryAction}
        disabled
        title="Importe un morceau pour pouvoir l'enregistrer"
      >
        Enregistrer
      </button>
    )
  }
  if (saving) {
    return (
      <button type="button" className={styles.secondaryAction} disabled>
        Enregistrement…
      </button>
    )
  }
  if (hasProject) {
    return (
      <>
        <button
          type="button"
          className={styles.secondaryAction}
          onClick={() => onSaveProject(saveName)}
        >
          Enregistrer
        </button>
        <NameEditor
          title="Enregistrer sous un autre nom"
          triggerClassName={cx(styles.secondaryAction)}
          triggerLabel="Renommer le projet"
          triggerContent="Renommer…"
          submitLabel="Enregistrer"
          initialName={saveName}
          onSubmit={onSaveProject}
        />
      </>
    )
  }
  return (
    <NameEditor
      title="Enregistrer le projet"
      triggerClassName={cx(styles.secondaryAction)}
      triggerLabel="Enregistrer le projet"
      triggerContent="Enregistrer"
      submitLabel="Enregistrer"
      initialName={saveName}
      onSubmit={onSaveProject}
    />
  )
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
  serverStatus,
  onImport,
  onShowShortcuts,
  onSaveProject,
  saveName,
  canSave,
  hasProject,
  saving,
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
        {serverStatus && (
          <span className={styles.serverStatus} data-tone={serverStatus.tone}>
            <span className={styles.statusDot} aria-hidden="true" />
            {serverStatus.label}
          </span>
        )}
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
        {onSaveProject && (
          <SaveControls
            onSaveProject={onSaveProject}
            saveName={saveName ?? ''}
            canSave={canSave === true}
            hasProject={hasProject === true}
            saving={saving === true}
          />
        )}
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
