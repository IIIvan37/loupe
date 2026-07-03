import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { useRef } from 'react'
import type { ServerHealth } from '../../projects/use-server-health.ts'
import { Header } from '../header/header.tsx'
import { AlertBanner } from '../ui/alert-banner.tsx'
import type { ProjectSession } from './use-project-session.ts'
import styles from './workstation-shell.module.css'

/**
 * No real key/tempo detection yet — show nothing rather than a hardcoded lie.
 * The header keeps its `detected` prop for when detection lands.
 */
const DETECTED: readonly never[] = []

/** How each probed health state reads in the header. */
const SERVER_STATUS: Record<
  Exclude<ServerHealth, 'checking'>,
  {
    readonly tone: 'offline' | 'degraded' | 'ready'
    readonly label: MessageDescriptor
  }
> = {
  offline: {
    tone: 'offline',
    label: msg({ id: 'header.server-offline', message: 'Serveur hors ligne' })
  },
  'no-separation': {
    tone: 'degraded',
    label: msg({
      id: 'header.server-no-separation',
      message: 'Séparation indisponible'
    })
  },
  ready: {
    tone: 'ready',
    label: msg({ id: 'header.server-ready', message: 'Serveur prêt' })
  }
}

interface ShellHeaderProps {
  readonly metadata: {
    readonly title: string | undefined
    readonly artist: string | undefined
  }
  readonly serverHealth: ServerHealth
  readonly session: ProjectSession
  readonly isLoaded: boolean
  readonly stemsReady: boolean
  readonly onExportStems: () => void
  readonly onShowShortcuts: () => void
  readonly onShowProjects: () => void
  /** The stem-export failure banner (owned by the separation hook). */
  readonly exportError: string | undefined
  readonly onDismissExportError: () => void
}

/**
 * The header region: document identity + actions, the error banners right
 * under it, and the hidden file input the « Importer » button drives — the
 * single import entry point lives here.
 */
export function ShellHeader({
  metadata,
  serverHealth,
  session,
  isLoaded,
  stemsReady,
  onExportStems,
  onShowShortcuts,
  onShowProjects,
  exportError,
  onDismissExportError
}: ShellHeaderProps) {
  const { t } = useLingui()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { projects, trackName, currentProject } = session

  // The long operations get one visible status strip (the dialog may be
  // closed while an open is still rebuilding the session).
  const openingProject = projects.projects.find(
    (p) => p.id === session.openingId
  )
  const name = openingProject?.name
  const busyMessage =
    projects.busy === 'save'
      ? t({ id: 'header.saving', message: 'Enregistrement du projet…' })
      : name !== undefined
        ? t({ id: 'header.opening', message: `Ouverture de « ${name} »…` })
        : undefined

  return (
    <>
      <Header
        title={
          metadata.title ??
          trackName ??
          t({ id: 'header.no-track', message: 'Aucun morceau' })
        }
        artist={
          metadata.artist ??
          (trackName
            ? t({ id: 'header.unknown-artist', message: 'Artiste inconnu' })
            : t({
                id: 'header.import-file',
                message: 'Importer un fichier audio'
              }))
        }
        detected={DETECTED}
        serverStatus={
          serverHealth === 'checking'
            ? undefined
            : {
                tone: SERVER_STATUS[serverHealth].tone,
                label: t(SERVER_STATUS[serverHealth].label)
              }
        }
        onImport={() => fileInputRef.current?.click()}
        importNeedsConfirm={session.unsavedWork}
        onExportStems={onExportStems}
        canExport={stemsReady}
        onShowShortcuts={onShowShortcuts}
        onSaveProject={session.handleSave}
        saveName={currentProject?.name ?? trackName ?? ''}
        canSave={isLoaded}
        hasProject={currentProject !== undefined}
        saving={projects.busy === 'save'}
        dirty={session.dirty}
        busyMessage={busyMessage}
        onShowProjects={onShowProjects}
      />
      {projects.error !== undefined && (
        <AlertBanner
          message={projects.error}
          onDismiss={projects.dismissError}
        />
      )}
      {exportError !== undefined && (
        <AlertBanner message={exportError} onDismiss={onDismissExportError} />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className={styles.fileInput}
        aria-label={t({
          id: 'header.import-file',
          message: 'Importer un fichier audio'
        })}
        onChange={session.onFilePicked}
      />
    </>
  )
}
