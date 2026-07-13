import type { StructureDetectionErrorCode } from '@app/core'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Cluster } from '../../layout/cluster/cluster.tsx'
import { Stack } from '../../layout/stack/stack.tsx'
import { LiveStatus } from '../ui/live-status.tsx'
import { useTwoStepConfirm } from '../ui/use-two-step-confirm.ts'
import styles from './marker-controls.module.css'

/** The blocked-state hint, shared with the `network` failure copy below. */
const NEEDS_SERVER = msg({
  id: 'structure.detect-needs-server',
  message: 'Lancer le serveur local pour détecter la structure.'
})

/**
 * One actionable, translated line per failure code (Lot G standard) — the raw
 * engine/transport detail never reaches the UI (the hook logs it to the
 * console). `network` reuses the blocked-state hint: same situation, same words.
 */
const ERROR_COPY: Readonly<
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
  network: NEEDS_SERVER,
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

/** The structure-detection surface the shell wires in (absent = not wired). */
export interface StructureDetectionControl {
  /** Why detection is unavailable (disables the button + explains under it). */
  readonly blockedReason: 'server' | undefined
  readonly detecting: boolean
  /** Why the last run failed — a code mapped here to translated copy. */
  readonly error: StructureDetectionErrorCode | undefined
  readonly succeeded: boolean
  /** Whether markers already exist — a detection replaces them, so it confirms. */
  readonly hasMarkers: boolean
  readonly onDetect: () => void
}

interface MarkerControlsProps {
  readonly disabled: boolean
  readonly onAdd: () => void
  /** « Détecter la structure » — the flow that places section markers. */
  readonly detection?: StructureDetectionControl
}

/** Dumb-ish control: drop a named marker, or auto-detect the song's sections. */
export function MarkerControls({ disabled, onAdd, detection }: MarkerControlsProps) {
  const { t } = useLingui()
  // A detection REPLACES the markers — an existing set is armed work, so the
  // first activation only swaps the button to « Remplacer les repères ? ».
  const overwrite = useTwoStepConfirm<true>()

  function onDetectClick(): void {
    if (!detection) {
      return
    }
    if (detection.hasMarkers && overwrite.pending === null) {
      overwrite.arm(true)
      return
    }
    overwrite.disarm()
    detection.onDetect()
  }

  const blockedHint =
    detection?.blockedReason === 'server' ? t(NEEDS_SERVER) : undefined

  // The full failure line — shown AND announced, so a screen-reader user hears
  // the same actionable reason a sighted user reads.
  const failureLine =
    detection?.error !== undefined
      ? `${t({
          id: 'structure.detect-failed',
          message: 'Échec de la détection de la structure'
        })} — ${t(ERROR_COPY[detection.error])}`
      : undefined

  const announced = detection?.detecting
    ? t({ id: 'structure.detecting', message: 'Détection de la structure…' })
    : detection?.succeeded
      ? t({
          id: 'structure.detect-done',
          message: 'Repères de structure posés depuis la détection'
        })
      : failureLine

  return (
    <Stack gap="var(--space-xs)">
      <Cluster gap="var(--space-xs)" align="center">
        <span className={styles.label}>
          <Trans id="markers.section-label">Repères</Trans>
        </span>
        <button
          type="button"
          className={styles.add}
          disabled={disabled}
          onClick={onAdd}
        >
          <Trans id="markers.add">+ Repère</Trans>
        </button>
        {detection && (
          <button
            type="button"
            className={styles.detect}
            disabled={
              disabled ||
              detection.blockedReason !== undefined ||
              detection.detecting
            }
            onClick={onDetectClick}
            onBlur={overwrite.disarm}
          >
            {detection.detecting
              ? t({
                  id: 'structure.detecting-short',
                  message: 'Détection…'
                })
              : overwrite.pending
                ? t({
                    id: 'structure.detect-confirm',
                    message: 'Remplacer les repères ?'
                  })
                : t({
                    id: 'structure.detect',
                    message: 'Détecter la structure'
                  })}
          </button>
        )}
      </Cluster>
      {blockedHint !== undefined && <p className={styles.hint}>{blockedHint}</p>}
      {failureLine !== undefined && <p className={styles.error}>{failureLine}</p>}
      {/* The one live region for the detection flow — kept mounted so a
          state change (busy → done / failed) is spoken. */}
      {detection && <LiveStatus message={announced} />}
    </Stack>
  )
}
