import { Trans, useLingui } from '@lingui/react/macro'
import { Cluster } from '../../layout/cluster/cluster.tsx'
import { cx } from '../../lib/cx.ts'
import { NameEditor } from '../ui/name-editor.tsx'
import { useTwoStepConfirm } from '../ui/use-two-step-confirm.ts'
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
  const { t } = useLingui()
  if (!canSave) {
    return (
      <button
        type="button"
        className={styles.secondaryAction}
        disabled
        title={t({
          id: 'header.save-needs-track',
          message: "Importer un morceau pour pouvoir l'enregistrer"
        })}
      >
        <Trans id="common.save">Enregistrer</Trans>
      </button>
    )
  }
  if (saving) {
    // The header's state chip narrates the save; the button just locks.
    return (
      <button type="button" className={styles.secondaryAction} disabled>
        <Trans id="common.save">Enregistrer</Trans>
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
          <Trans id="common.save">Enregistrer</Trans>
        </button>
        <NameEditor
          title={t({
            id: 'header.save-as',
            message: 'Enregistrer sous un autre nom'
          })}
          triggerClassName={cx(styles.iconAction)}
          triggerLabel={t({
            id: 'header.rename-project',
            message: 'Renommer le projet'
          })}
          triggerContent="✎"
          submitLabel={t({ id: 'common.save', message: 'Enregistrer' })}
          initialName={saveName}
          onSubmit={onSaveProject}
        />
      </>
    )
  }
  return (
    <NameEditor
      title={t({ id: 'header.save-project', message: 'Enregistrer le projet' })}
      triggerClassName={cx(styles.secondaryAction)}
      triggerLabel={t({
        id: 'header.save-project',
        message: 'Enregistrer le projet'
      })}
      triggerContent={t({ id: 'common.save', message: 'Enregistrer' })}
      submitLabel={t({ id: 'common.save', message: 'Enregistrer' })}
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
  const { t } = useLingui()
  const confirm = useTwoStepConfirm<true>()
  const armed = confirm.pending !== null

  // The session settled (e.g. a save landed) while armed — the destructive
  // warning no longer applies; drop it during render, no effect round-trip.
  if (armed && !needsConfirm) {
    confirm.disarm()
  }

  function onClick(): void {
    if (armed) {
      confirm.disarm()
      onImport()
      return
    }
    if (needsConfirm) {
      confirm.arm(true)
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
          ? t({
              id: 'header.import-confirm',
              message: "Confirmer l'import — la session actuelle sera remplacée"
            })
          : undefined
      }
      title={
        armed
          ? t({
              id: 'session.replaced',
              message: 'La session actuelle sera remplacée'
            })
          : undefined
      }
      onBlur={armed ? confirm.disarm : undefined}
      onClick={onClick}
    >
      {armed
        ? t({ id: 'common.confirm', message: 'Confirmer ?' })
        : t({ id: 'header.import', message: 'Importer' })}
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
  const { t } = useLingui()
  // The one document-state chip: a running operation narrates itself; otherwise
  // the saved/dirty read-out (which only means something once a project exists).
  const savedState = dirty
    ? t({ id: 'header.unsaved', message: '● Non enregistré' })
    : t({ id: 'header.saved', message: 'Enregistré' })
  const sessionState = busyMessage ?? (hasProject ? savedState : undefined)

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
          aria-label={t({
            id: 'header.show-shortcuts',
            message: 'Afficher les raccourcis clavier'
          })}
          title={t({ id: 'header.shortcuts-tip', message: 'Raccourcis clavier' })}
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
              ? t({
                  id: 'header.export-ready',
                  message: 'Télécharger les stems en ZIP'
                })
              : t({
                  id: 'header.export-needs-stems',
                  message: 'Séparer les pistes pour exporter les stems'
                })
          }
          onClick={onExportStems}
        >
          <Trans id="header.export">Exporter</Trans>
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
            <Trans id="header.projects">Projets</Trans>
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
