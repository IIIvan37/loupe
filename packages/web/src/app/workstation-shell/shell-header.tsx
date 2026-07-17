import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { appAuth } from '../../auth/app-auth.ts'
import type { AuthPort, MintFailureReason } from '../../auth/auth-port.ts'
import type { ServerHealth } from '../../projects/use-server-health.ts'
import { AccountMenuSlot } from '../account/account-menu-slot.tsx'
import { Header } from '../header/header.tsx'
import type { UrlImport } from '../header/use-import-from-url.ts'
import { AlertBanner } from '../ui/alert-banner.tsx'
import type { ProjectSession } from './use-project-session.ts'

/** Stable empty default — a `[]` default would defeat prop comparison. */
const NO_GATE_REASONS: readonly (MintFailureReason | undefined)[] = []

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
  /** The URL-import lifecycle: progress narrated in the state chip, errors below. */
  readonly urlImport: UrlImport
  readonly isLoaded: boolean
  readonly stemsReady: boolean
  /** Open the file picker — the shell owns the hidden input, shared with the drop hero. */
  readonly onImport: () => void
  readonly onExportStems: () => void
  /** Whether the stems zip is being built — narrated by the busy line. */
  readonly exportingStems: boolean
  readonly onShowShortcuts: () => void
  readonly onShowProjects: () => void
  /** The stem-export failure banner (owned by the separation hook). */
  readonly exportError: string | undefined
  readonly onDismissExportError: () => void
  /** The auth port (J2): injected in tests, else the app singleton. `null` when
   * Supabase isn't configured → no account control. */
  readonly auth?: AuthPort | null
  /** A blocked analysis pops the account menu open with a prompt — one slot
   * per flow (structure, tempo, chords), compared per flow (M1.1). */
  readonly gateReasons?: readonly (MintFailureReason | undefined)[]
}

/**
 * The header region: document identity + actions, and the error banners right
 * under it. The « Importer » button drives the shell's shared file picker.
 */
export function ShellHeader({
  metadata,
  serverHealth,
  session,
  urlImport,
  isLoaded,
  stemsReady,
  onImport,
  onExportStems,
  exportingStems,
  onShowShortcuts,
  onShowProjects,
  exportError,
  onDismissExportError,
  auth,
  gateReasons = NO_GATE_REASONS
}: ShellHeaderProps) {
  const { t } = useLingui()
  const { projects, trackName, currentProject } = session
  // The account port: injected in tests, else the app singleton (null when
  // Supabase isn't configured → no control, the analysis gate is a no-op).
  const resolvedAuth = auth !== undefined ? auth : appAuth()

  // A running URL download narrates itself in the busy line, phase by phase
  // — the percentage rides the progress bar, not the copy (R.4).
  let downloadBusy: { label: string; progress?: number } | undefined
  if (urlImport.progress !== undefined) {
    downloadBusy =
      urlImport.progress.phase === 'downloading'
        ? {
            label: t({ id: 'header.downloading', message: 'Téléchargement…' }),
            progress: urlImport.progress.fraction
          }
        : {
            label: t({
              id: 'header.transcoding',
              message: "Extraction de l'audio…"
            })
          }
  }

  // The long operations get one visible status strip (the dialog may be
  // closed while an open is still rebuilding the session).
  const openingProject = projects.projects.find(
    (p) => p.id === session.openingId
  )
  const name = openingProject?.name
  let pendingBusy: { label: string; progress?: number } | undefined
  if (projects.busy === 'save' || session.preparingSave) {
    pendingBusy = {
      label: t({ id: 'header.saving', message: 'Enregistrement du projet…' })
    }
  } else if (exportingStems) {
    pendingBusy = {
      label: t({ id: 'header.exporting', message: 'Export des stems…' })
    }
  } else if (name !== undefined) {
    pendingBusy = {
      label: t({ id: 'header.opening', message: `Ouverture de « ${name} »…` })
    }
  }
  const busy = downloadBusy ?? pendingBusy

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
        serverStatus={
          serverHealth === 'checking'
            ? undefined
            : {
                tone: SERVER_STATUS[serverHealth].tone,
                label: t(SERVER_STATUS[serverHealth].label)
              }
        }
        onImport={onImport}
        onImportUrl={urlImport.submit}
        urlImportBusy={urlImport.running}
        importNeedsConfirm={session.unsavedWork}
        onExportStems={onExportStems}
        canExport={stemsReady}
        onShowShortcuts={onShowShortcuts}
        onSaveProject={session.handleSave}
        saveName={currentProject?.name ?? trackName ?? ''}
        canSave={isLoaded}
        hasProject={currentProject !== undefined}
        saving={projects.busy === 'save' || session.preparingSave}
        dirty={session.dirty}
        busyMessage={busy?.label}
        busyProgress={busy?.progress}
        onCancelBusy={
          downloadBusy !== undefined ? urlImport.cancel : undefined
        }
        onShowProjects={onShowProjects}
        accountSlot={
          resolvedAuth && (
            <AccountMenuSlot auth={resolvedAuth} gateReasons={gateReasons} />
          )
        }
      />
      {urlImport.error !== undefined && (
        <AlertBanner
          message={urlImport.error}
          onDismiss={urlImport.dismissError}
        />
      )}
      {projects.error !== undefined && (
        <AlertBanner
          message={projects.error}
          onDismiss={projects.dismissError}
        />
      )}
      {exportError !== undefined && (
        <AlertBanner message={exportError} onDismiss={onDismissExportError} />
      )}
    </>
  )
}
