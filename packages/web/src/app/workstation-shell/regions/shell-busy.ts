import { msg } from '@lingui/core/macro'
import { i18n } from '../../../i18n/i18n.ts'
import type { UrlImport } from '../../header/use-import-from-url.ts'
import type { ProjectSession } from '../orchestration/use-project-session.ts'

// One catalog entry per fact, shared by the header's busy line and the
// take-charge overlay (AS.3) — the two faces must never drift apart.
const DOWNLOADING = msg({
  id: 'header.downloading',
  message: 'Téléchargement…'
})
const TRANSCODING = msg({
  id: 'header.transcoding',
  message: "Extraction de l'audio…"
})
const OPENING = msg({
  id: 'header.opening',
  message: 'Ouverture de « {name} »…'
})
const OPENING_STEM = msg({
  id: 'header.opening-stem',
  message: 'Ouverture de « {name} »… — piste {stem}/{total}'
})
const DECODING = msg({ id: 'waveform.decoding', message: 'Décodage…' })

/** One busy line: resolved label + the real fraction when the flow streams one. */
export interface BusyLine {
  readonly label: string
  readonly progress?: number | undefined
}

/** The running URL download, phase by phase — the percentage rides the
 * progress bar, not the copy (R.4); no fraction before the first real tick
 * (AS.1). Undefined while no download runs. */
export function urlImportBusy(urlImport: UrlImport): BusyLine | undefined {
  if (urlImport.progress === undefined) {
    return undefined
  }
  return urlImport.progress.phase === 'downloading'
    ? {
        label: i18n._(DOWNLOADING),
        progress: urlImport.progress.fraction
      }
    : { label: i18n._(TRANSCODING) }
}

/** The project open being rebuilt, narrating the stem decode when the restore
 * reports one (« piste n/total », AS.4). Undefined while no open runs. */
export function openingBusy(session: ProjectSession): BusyLine | undefined {
  const name = session.projects.projects.find(
    (project) => project.id === session.openingId
  )?.name
  if (name === undefined) {
    return undefined
  }
  const step = session.openingStem
  return step === undefined
    ? { label: i18n._({ ...OPENING, values: { name } }) }
    : {
        label: i18n._({
          ...OPENING_STEM,
          values: { name, stem: step.stem, total: step.total }
        })
      }
}

/**
 * What stands between the user's gesture and the ready workshop (AS.3): a
 * project open, a URL download, or a picked file's decode — derived from the
 * existing states only, no new machine. Drives the take-charge overlay.
 */
export function takeChargeBusy(
  session: ProjectSession,
  urlImport: UrlImport,
  importStatus: 'idle' | 'loading' | 'loaded' | 'error'
): BusyLine | undefined {
  // An open re-imports its bytes: its narration owns the whole stretch.
  return (
    openingBusy(session) ??
    urlImportBusy(urlImport) ??
    (importStatus === 'loading' ? { label: i18n._(DECODING) } : undefined)
  )
}
