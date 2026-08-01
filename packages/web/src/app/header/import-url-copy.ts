import type { ImportUrlErrorCode } from '@app/core'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

/**
 * The URL import's failure copy (AV.1, the detections' Lot G standard): one
 * translated line per NDJSON error code — the server's raw English message
 * never reaches the UI (the hook logs it to the console). The `Record` type
 * keeps the table exhaustive against the core's code union at compile time.
 */
export const IMPORT_URL_ERROR_COPY: Readonly<
  Record<ImportUrlErrorCode, MessageDescriptor>
> = {
  unsupported: msg({
    id: 'import.url-error.unsupported',
    message: 'Source non prise en charge — YouTube ou SoundCloud uniquement.'
  }),
  timeout: msg({
    id: 'import.url-error.timeout',
    message: 'Le téléchargement a expiré — réessayer.'
  }),
  'extractor-stale': msg({
    id: 'import.url-error.extractor-stale',
    message:
      "Téléchargement impossible — l'outil de téléchargement se met à jour, réessayer plus tard."
  }),
  'store-quota': msg({
    id: 'import.url-error.store-quota',
    message:
      'Stockage audio plein — supprimer des projets pour libérer de la place.'
  }),
  unknown: msg({
    id: 'import.url-error.unknown',
    message: "L'import du lien a échoué — réessayer."
  })
}
