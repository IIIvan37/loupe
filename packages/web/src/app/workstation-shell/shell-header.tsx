import { useLingui } from '@lingui/react/macro'
import { appAuth } from '../../auth/app-auth.ts'
import { useWindowTitle } from './use-window-title.ts'
import type { AuthPort, MintFailureReason } from '../../auth/auth-port.ts'
import { AccountMenuSlot } from '../account/account-menu-slot.tsx'
import { Header } from '../header/header.tsx'
import type { UrlImport } from '../header/use-import-from-url.ts'
import { AlertBanner } from '../ui/alert-banner.tsx'
import type { ProjectSession } from './use-project-session.ts'

/** Stable empty default — a `[]` default would defeat prop comparison. */
const NO_GATE_REASONS: readonly (MintFailureReason | undefined)[] = []

interface ShellHeaderProps {
  readonly metadata: {
    readonly title: string | undefined
    readonly artist: string | undefined
  }
  readonly session: ProjectSession
  /** Whether the desktop shell hosts the app (Tauri). Offload-only (Lot AJ):
   * saved projects and URL import are desktop-only — the browser hides them. */
  readonly desktop: boolean
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
  /** Replay the gate-blocked analysis once the user signs in (AK.1). */
  readonly onResumeAfterSignIn?: (() => void) | undefined
}

/**
 * The header region: document identity + actions, and the error banners right
 * under it. The « Importer » button drives the shell's shared file picker.
 */
export function ShellHeader({
  metadata,
  session,
  desktop,
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
  gateReasons = NO_GATE_REASONS,
  onResumeAfterSignIn
}: ShellHeaderProps) {
  const { t } = useLingui()
  const { projects, trackName, currentProject } = session
  // The account port: injected in tests, else the app singleton (null when
  // Supabase isn't configured → no control, the analysis gate is a no-op).
  const resolvedAuth = auth !== undefined ? auth : appAuth()

  // The window title mirrors this header's identity line (AP.3):
  // « morceau — Loupe » + dirty dot, browser tab and native window alike.
  useWindowTitle(metadata.title, session.unsavedWork)

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
        onImport={onImport}
        // Saved projects + URL import are desktop-only (offload-only, Lot AJ):
        // in the browser the callbacks are absent, so the entries hide.
        onImportUrl={desktop ? urlImport.submit : undefined}
        urlImportBusy={urlImport.running}
        importNeedsConfirm={session.unsavedWork}
        onExportStems={onExportStems}
        canExport={stemsReady}
        onShowShortcuts={onShowShortcuts}
        onSaveProject={desktop ? session.handleSave : undefined}
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
        onShowProjects={desktop ? onShowProjects : undefined}
        accountSlot={
          resolvedAuth && (
            <AccountMenuSlot
              auth={resolvedAuth}
              gateReasons={gateReasons}
              onResumeAfterSignIn={onResumeAfterSignIn}
            />
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
