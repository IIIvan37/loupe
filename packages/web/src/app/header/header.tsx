import { useEffect, useRef, useState } from 'react'
import { Cluster } from '../../layout/cluster/cluster.tsx'
import { cx } from '../../lib/cx.ts'
import { NameEditor } from '../ui/name-editor.tsx'
import styles from './header.module.css'

/** How long the armed « Confirmer ? » stays armed before reverting. */
const CONFIRM_REVERT_MS = 4000

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
  /** Ask before importing: the session holds work a new track would discard. */
  readonly importNeedsConfirm?: boolean | undefined
  /** Download the separated stems as one zip. The shell owns the export. */
  readonly onExportStems: () => void
  /** Whether there are stems to export (a separation is ready). */
  readonly canExport: boolean
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
  /** Whether the session has changes the saved project does not (undefined = no project). */
  readonly dirty?: boolean | undefined
  /** A long operation in flight (save, open/rebuild) — takes over the state chip. */
  readonly busyMessage?: string | undefined
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
    // The header's state chip narrates the save; the button just locks.
    return (
      <button type="button" className={styles.secondaryAction} disabled>
        Enregistrer
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
          triggerClassName={cx(styles.iconAction)}
          triggerLabel="Renommer le projet"
          triggerContent="✎"
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

interface ImportButtonProps {
  readonly onImport: () => void
  readonly needsConfirm: boolean
}

/**
 * The single import entry point, guarded: while the session holds unsaved
 * work the first click arms a « Confirmer ? » on the same element (swapping
 * elements would drop focus), which reverts on blur or after a few seconds.
 */
function ImportButton({ onImport, needsConfirm }: ImportButtonProps) {
  const [armed, setArmed] = useState(false)
  const revertTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  // Clear the revert timer on unmount so it never fires into a gone component.
  useEffect(() => () => clearTimeout(revertTimer.current), [])

  function disarm(): void {
    clearTimeout(revertTimer.current)
    setArmed(false)
  }

  function onClick(): void {
    if (armed) {
      disarm()
      onImport()
      return
    }
    if (needsConfirm) {
      setArmed(true)
      revertTimer.current = setTimeout(() => setArmed(false), CONFIRM_REVERT_MS)
      return
    }
    onImport()
  }

  return (
    <button
      type="button"
      className={armed ? styles.confirmAction : styles.primaryAction}
      data-on-amber={armed ? undefined : ''}
      aria-label={
        armed
          ? "Confirmer l'import — la session actuelle sera remplacée"
          : undefined
      }
      title={armed ? 'La session actuelle sera remplacée' : undefined}
      onBlur={armed ? disarm : undefined}
      onClick={onClick}
    >
      {armed ? 'Confirmer ?' : 'Importer'}
    </button>
  )
}

/**
 * Dumb presentational header, one place per kind of information: the document
 * (title, artist, detected values, saved/busy state) on the left with the logo;
 * the actions on the right; the server health — infrastructure, not an action —
 * alone at the far right. Detected values (key/BPM/measure) are rendered in
 * teal + mono per the semantic rule (teal = what the machine detected). The
 * "Importer" button is the single import entry point; the shell wires it.
 */
export function Header({
  title,
  artist,
  detected,
  serverStatus,
  onImport,
  importNeedsConfirm,
  onExportStems,
  canExport,
  onShowShortcuts,
  onSaveProject,
  saveName,
  canSave,
  hasProject,
  saving,
  dirty,
  busyMessage,
  onShowProjects
}: HeaderProps) {
  // The one document-state chip: a running operation narrates itself; otherwise
  // the saved/dirty read-out (which only means something once a project exists).
  const sessionState =
    busyMessage ??
    (hasProject ? (dirty ? '● Non enregistré' : 'Enregistré') : undefined)

  return (
    <header className={styles.header}>
      <Cluster gap="var(--space-l)" align="center">
        <span className={styles.logo}>Loupe</span>
        <div className={styles.track}>
          <p className={styles.title}>{title}</p>
          <p className={styles.artist}>{artist}</p>
        </div>
        {detected.map((item) => (
          <span key={item.id} className={styles.readout}>
            <span className={styles.readoutLabel}>{item.label}</span>
            <span className={styles.readoutValue}>{item.value}</span>
          </span>
        ))}
        {sessionState !== undefined && (
          <output
            className={cx(
              styles.saveState,
              busyMessage !== undefined
                ? styles.saveStateBusy
                : dirty && styles.saveStateDirty
            )}
          >
            {sessionState}
          </output>
        )}
      </Cluster>

      <Cluster gap="var(--space-s)" align="center">
        <button
          type="button"
          className={styles.iconAction}
          aria-label="Afficher les raccourcis clavier"
          title="Raccourcis clavier"
          onClick={onShowShortcuts}
        >
          ?
        </button>
        <ImportButton
          onImport={onImport}
          needsConfirm={importNeedsConfirm === true}
        />
        <button
          type="button"
          className={styles.secondaryAction}
          disabled={!canExport}
          title={
            canExport
              ? 'Télécharger les stems en ZIP'
              : 'Sépare les pistes pour exporter les stems'
          }
          onClick={onExportStems}
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
        {serverStatus && (
          <span className={styles.serverStatus} data-tone={serverStatus.tone}>
            <span className={styles.statusDot} aria-hidden="true" />
            {serverStatus.label}
          </span>
        )}
      </Cluster>
    </header>
  )
}
