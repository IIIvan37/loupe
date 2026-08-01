import type { ProjectErrorCode } from '@app/core'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

/**
 * The project operations' failure copy (AV.2, the detections' standard): one
 * translated reason per error code, composed after the per-operation French
 * prefix (« Impossible d'enregistrer le projet : … ») — the raw English
 * detail never reaches the UI (the hook logs it to the console). The `Record`
 * type keeps the table exhaustive against the core's code union.
 */
export const PROJECT_ERROR_COPY: Readonly<
  Record<ProjectErrorCode, MessageDescriptor>
> = {
  network: msg({
    id: 'projects.error.network',
    message: 'serveur de projets injoignable — réessayer'
  }),
  server: msg({
    id: 'projects.error.server',
    message: 'le serveur de projets a répondu une erreur — réessayer'
  }),
  unreadable: msg({
    id: 'projects.error.unreadable',
    message: 'données du projet illisibles'
  }),
  'not-found': msg({
    id: 'projects.error.not-found',
    message: 'projet introuvable'
  }),
  'empty-name': msg({
    id: 'projects.error.empty-name',
    message: 'le nom ne peut pas rester vide'
  }),
  'mixer-mismatch': msg({
    id: 'projects.error.mixer-mismatch',
    message: 'données de session incohérentes — réessayer'
  }),
  'missing-audio': msg({
    id: 'projects.error.missing-audio',
    message: 'audio du projet introuvable'
  }),
  unknown: msg({
    id: 'projects.error.unknown',
    message: 'erreur inattendue — réessayer'
  })
}
