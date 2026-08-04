import type {
  ChordDetectionErrorCode,
  SeparationErrorCode,
  SeparationPhase,
  StructureDetectionErrorCode,
  TempoDetectionErrorCode
} from '@app/core'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

/**
 * The analysis flows' actionable copy (Lot G standard), gathered where the
 * analyser row consumes it: one translated line per blocked state or failure
 * code — the raw transport detail never reaches the UI (the hooks log it to
 * the console). Offload-only (Lot AJ): every analysis runs on the remote
 * service, so the copy names « le service d'analyse » — never a local server,
 * an install step, or the browser console.
 */

/** The `network` face, shared by the four analyses (X.1/M1.1 → AJ): the remote
 * service is unreachable, so the remedy is simply to retry. */
export const ANALYSIS_OFFLOAD_UNREACHABLE = msg({
  id: 'analysis.error.network-offload',
  message: "Service d'analyse injoignable — réessayer."
})

/** The transport faces every analysis flow words identically, spread into each
 * per-flow table below — a new shared code (an auth refusal) lands here once;
 * `timeout`/`too-large` stay per flow because their copy names the analysis. */
const SHARED_TRANSPORT_COPY = {
  'engine-unavailable': msg({
    id: 'analysis.error.engine-unavailable',
    message:
      "Service d'analyse indisponible pour le moment — réessayer plus tard."
  }),
  network: ANALYSIS_OFFLOAD_UNREACHABLE,
  unknown: msg({
    id: 'analysis.error.unknown',
    message: 'Erreur inattendue — réessayer.'
  })
} satisfies Partial<Record<SeparationErrorCode, MessageDescriptor>>

/** The separation's running-phase labels — worn by the analyser row's busy
 * face AND the folded zone's live segment (AS.5): one catalog entry per phase. */
export const SEPARATION_PROGRESS_LABELS: Readonly<
  Record<SeparationPhase, MessageDescriptor>
> = {
  analysing: msg({ id: 'separation.analysing', message: 'Analyse du mix…' }),
  separating: msg({
    id: 'separation.separating',
    message: 'Séparation des pistes…'
  }),
  retrieving: msg({
    id: 'separation.retrieving',
    message: 'Récupération des pistes…'
  })
}

export const STRUCTURE_ERROR_COPY: Readonly<
  Record<StructureDetectionErrorCode, MessageDescriptor>
> = {
  ...SHARED_TRANSPORT_COPY,
  'no-structure': msg({
    id: 'structure.error.no-structure',
    message: 'Aucune structure détectée sur ce morceau.'
  }),
  timeout: msg({
    id: 'structure.error.timeout',
    message: "L'analyse de la structure a expiré — réessayer."
  }),
  'too-large': msg({
    id: 'structure.error.too-large',
    message: "Morceau trop volumineux pour l'analyse."
  })
}

export const CHORDS_NEEDS_GRID = msg({
  id: 'chords.detect-needs-grid',
  message: "Détecter d'abord le tempo — la grille de mesures ancre les accords."
})

/** `no-downbeat` reuses the grid hint. */
export const CHORDS_ERROR_COPY: Readonly<
  Record<ChordDetectionErrorCode, MessageDescriptor>
> = {
  ...SHARED_TRANSPORT_COPY,
  'no-downbeat': CHORDS_NEEDS_GRID,
  'no-chords': msg({
    id: 'chords.error.no-chords',
    message: 'Aucun accord détecté sur ce morceau.'
  }),
  timeout: msg({
    id: 'chords.error.timeout',
    message: "L'analyse des accords a expiré — réessayer."
  }),
  'too-large': msg({
    id: 'chords.error.too-large',
    message: "Morceau trop volumineux pour l'analyse."
  })
}

export const TEMPO_ERROR_COPY: Readonly<
  Record<TempoDetectionErrorCode, MessageDescriptor>
> = {
  ...SHARED_TRANSPORT_COPY,
  timeout: msg({
    id: 'tempo.error.timeout',
    message: "L'analyse du tempo a expiré — réessayer."
  }),
  'too-large': msg({
    id: 'tempo.error.too-large',
    message: "Morceau trop volumineux pour l'analyse."
  })
}

/** The offline block, shared by the four offloaded analysis flows (M1.4):
 * everything else keeps working without the network — only the analyses
 * need it, and each blocked item says so in the same words. */
export const ANALYSIS_OFFLINE = msg({
  id: 'analysis.blocked-offline',
  message: 'Hors ligne — les analyses nécessitent le réseau.'
})

/** (M1.4, the N.1 contract extended to separation.) */
export const SEPARATION_ERROR_COPY: Readonly<
  Record<SeparationErrorCode, MessageDescriptor>
> = {
  ...SHARED_TRANSPORT_COPY,
  timeout: msg({
    id: 'separation.error.timeout',
    message: 'La séparation a expiré — réessayer.'
  }),
  'too-large': msg({
    id: 'separation.error.too-large',
    message: 'Morceau trop volumineux pour la séparation.'
  })
}
