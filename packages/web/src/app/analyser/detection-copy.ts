import type {
  ChordDetectionErrorCode,
  StructureDetectionErrorCode,
  TempoDetectionErrorCode
} from '@app/core'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import type { ServerHealth } from '../../projects/use-server-health.ts'

/**
 * The analysis flows' actionable copy (Lot G standard), gathered where the
 * analyser row consumes it: one translated line per blocked state or failure
 * code — the raw engine/transport detail never reaches the UI (the hooks log
 * it to the console). Message ids are unchanged from the panels that used to
 * own these maps (tempo, markers, chord chart, separation).
 */

export const STRUCTURE_NEEDS_SERVER = msg({
  id: 'structure.detect-needs-server',
  message: 'Lancer le serveur local pour détecter la structure.'
})

/** The offload's `network` face (X.1): « lancer le serveur local » would be
 * the wrong remedy when the engine runs on Modal — name the real dependency. */
export const STRUCTURE_OFFLOAD_UNREACHABLE = msg({
  id: 'structure.error.network-offload',
  message: "Service d'analyse injoignable — réessayer."
})

/** `network` reuses the blocked-state hint: same situation, same words. */
export const STRUCTURE_ERROR_COPY: Readonly<
  Record<StructureDetectionErrorCode, MessageDescriptor>
> = {
  'no-structure': msg({
    id: 'structure.error.no-structure',
    message: 'Aucune structure détectée sur ce morceau.'
  }),
  'engine-unavailable': msg({
    id: 'structure.error.engine-unavailable',
    message:
      "Le moteur de structure n'est pas installé sur le serveur — voir server/README."
  }),
  network: STRUCTURE_NEEDS_SERVER,
  timeout: msg({
    id: 'structure.error.timeout',
    message: "L'analyse de la structure a expiré sur le serveur — réessayer."
  }),
  'too-large': msg({
    id: 'structure.error.too-large',
    message: "Piste trop volumineuse pour l'analyse sur le serveur."
  }),
  unknown: msg({
    id: 'structure.error.unknown',
    message: 'Erreur inattendue — détails dans la console du navigateur.'
  })
}

export const CHORDS_NEEDS_SERVER = msg({
  id: 'chords.detect-needs-server',
  message: 'Lancer le serveur local pour détecter les accords.'
})

export const CHORDS_NEEDS_GRID = msg({
  id: 'chords.detect-needs-grid',
  message: "Détecter d'abord le tempo — la grille de mesures ancre les accords."
})

/** `network` and `no-downbeat` reuse the blocked-state hints. */
export const CHORDS_ERROR_COPY: Readonly<
  Record<ChordDetectionErrorCode, MessageDescriptor>
> = {
  'no-downbeat': CHORDS_NEEDS_GRID,
  'no-chords': msg({
    id: 'chords.error.no-chords',
    message: 'Aucun accord détecté sur ce morceau.'
  }),
  'engine-unavailable': msg({
    id: 'chords.error.engine-unavailable',
    message:
      "Le moteur d'accords n'est pas installé sur le serveur — voir server/README."
  }),
  network: CHORDS_NEEDS_SERVER,
  timeout: msg({
    id: 'chords.error.timeout',
    message: "L'analyse des accords a expiré sur le serveur — réessayer."
  }),
  'too-large': msg({
    id: 'chords.error.too-large',
    message: "Piste trop volumineuse pour l'analyse sur le serveur."
  }),
  unknown: msg({
    id: 'chords.error.unknown',
    message: 'Erreur inattendue — détails dans la console du navigateur.'
  })
}

export const TEMPO_ERROR_COPY: Readonly<
  Record<TempoDetectionErrorCode, MessageDescriptor>
> = {
  'engine-unavailable': msg({
    id: 'tempo.error.engine-unavailable',
    message:
      "Le moteur de tempo n'est pas installé sur le serveur — voir server/README."
  }),
  network: msg({
    id: 'tempo.error.network',
    message: 'Lancer le serveur local pour détecter le tempo.'
  }),
  timeout: msg({
    id: 'tempo.error.timeout',
    message: "L'analyse du tempo a expiré sur le serveur — réessayer."
  }),
  'too-large': msg({
    id: 'tempo.error.too-large',
    message: "Piste trop volumineuse pour l'analyse sur le serveur."
  }),
  unknown: msg({
    id: 'tempo.error.unknown',
    message: 'Erreur inattendue — détails dans la console du navigateur.'
  })
}

/** Server states that make separation impossible, with an actionable reason. */
export const SEPARATION_SERVER_BLOCK: Partial<
  Record<ServerHealth, MessageDescriptor>
> = {
  offline: msg({
    id: 'separation.server-offline',
    message:
      'Serveur hors ligne — démarrer le serveur local pour séparer les pistes.'
  }),
  'no-separation': msg({
    id: 'separation.server-no-separation',
    message: 'Ce serveur ne fournit pas de moteur de séparation.'
  })
}
