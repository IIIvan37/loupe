import { Trans, useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { Cluster } from '../../layout/cluster/cluster.tsx'
import { cx } from '../../lib/cx.ts'
import { Icon } from '../ui/icon.tsx'
import { NameEditor } from '../ui/name-editor.tsx'
import styles from './header.module.css'
import { ImportMenu } from './import-menu.tsx'

/** The header's server read-out: a coloured dot plus a short label. */
export interface ServerStatus {
  readonly tone: 'offline' | 'degraded' | 'ready'
  readonly label: string
}

interface HeaderProps {
  readonly title: string
  readonly artist: string
  /** The local server's health, or undefined while still probing. */
  readonly serverStatus?: ServerStatus | undefined
  /** Open the file picker. The smart shell owns the actual import. */
  readonly onImport: () => void
  /** Start importing a track from a media URL. The shell owns the download. */
  readonly onImportUrl: (url: string) => void
  /** Whether a URL download is in flight — the URL submit locks. */
  readonly urlImportBusy?: boolean | undefined
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
  /** Abort the narrated operation, when it is cancellable (the URL download). */
  readonly onCancelBusy?: (() => void) | undefined
  /** Reveal the saved-projects dialog. The shell owns its state. */
  readonly onShowProjects?: () => void
  /** The account control (sign-in / quota), when analysis is offloaded (J2).
   * A slot so the dumb header stays free of auth wiring. */
  readonly accountSlot?: ReactNode
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
  const saveLabel = t({ id: 'common.save', message: 'Enregistrer' })
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
          triggerContent={<Icon name="edit" />}
          submitLabel={saveLabel}
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
      triggerContent={saveLabel}
      submitLabel={saveLabel}
      initialName={saveName}
      onSubmit={onSaveProject}
    />
  )
}

/**
 * Dumb presentational header, one place per kind of information: the document
 * (title, artist, saved/busy state) on the left with the logo;
 * the actions on the right; the server health — infrastructure, not an action —
 * alone at the far right. The acquired-state read-out lives in the Analyse
 * zone's folded header (Q.3), not here. The "Importer" button is the single
 * import entry point; the shell wires it.
 */
export function Header({
  title,
  artist,
  serverStatus,
  onImport,
  onImportUrl,
  urlImportBusy,
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
  onCancelBusy,
  onShowProjects,
  accountSlot
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
        {busyMessage !== undefined && onCancelBusy !== undefined && (
          <button
            type="button"
            className={styles.busyCancel}
            onClick={onCancelBusy}
          >
            <Trans id="common.cancel">Annuler</Trans>
          </button>
        )}
      </Cluster>

      {/* Q.4 — the actions read as families, not one flat rank: help, then
          track I/O (import/export), then document (save/projects), then the
          account + server infrastructure. The gap does the grouping. */}
      <Cluster gap="var(--space-m)" align="center">
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
        <Cluster gap="var(--space-2xs)" align="center">
          <ImportMenu
            onImportFile={onImport}
            onImportUrl={onImportUrl}
            urlBusy={urlImportBusy === true}
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
        </Cluster>
        <Cluster gap="var(--space-2xs)" align="center">
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
        </Cluster>
        <Cluster gap="var(--space-s)" align="center">
          {accountSlot}
          {serverStatus && (
            <span className={styles.serverStatus} data-tone={serverStatus.tone}>
              <span className={styles.statusDot} aria-hidden="true" />
              {serverStatus.label}
            </span>
          )}
        </Cluster>
      </Cluster>
    </header>
  )
}
