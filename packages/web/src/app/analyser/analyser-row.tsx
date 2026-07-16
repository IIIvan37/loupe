import type {
  ChordDetectionErrorCode,
  SeparationState,
  StructureDetectionErrorCode,
  TempoDetectionErrorCode
} from '@app/core'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { i18n } from '../../i18n/i18n.ts'
import { Cluster } from '../../layout/cluster/cluster.tsx'
import type { ServerHealth } from '../../projects/use-server-health.ts'
import { DetectionAction } from '../ui/detection-action.tsx'
import { OperationStatus } from '../ui/operation-status.tsx'
import { LiveStatus } from '../ui/live-status.tsx'
import {
  CHORDS_ERROR_COPY,
  CHORDS_NEEDS_GRID,
  CHORDS_NEEDS_SERVER,
  SEPARATION_SERVER_BLOCK,
  STRUCTURE_ERROR_COPY,
  STRUCTURE_NEEDS_SERVER,
  STRUCTURE_OFFLOAD_UNREACHABLE,
  TEMPO_ERROR_COPY
} from './detection-copy.ts'
import styles from './analyser-row.module.css'

// Module-level map: lazy descriptors, resolved at render time via i18n._.
const PROGRESS_LABELS: Readonly<
  Record<'analysing' | 'separating', MessageDescriptor>
> = {
  analysing: msg({ id: 'separation.analysing', message: 'Analyse du mix…' }),
  separating: msg({
    id: 'separation.separating',
    message: 'Séparation des pistes…'
  })
}

/** Spoken AND shown once the run lands: the row keeps a stable « done » face. */
const DONE_LABEL = msg({ id: 'separation.done', message: 'Pistes séparées' })

/** The failure line, with the transport detail the separation flow surfaces. */
const SEP_FAILED = msg({
  id: 'separation.failed',
  message: 'La séparation a échoué : {error}'
})

/** The separation surface, unchanged from the retired SeparationPanel. */
export interface SeparationControl {
  readonly state: SeparationState
  readonly canSeparate: boolean
  readonly serverHealth: ServerHealth
  readonly onSeparate: () => void
  readonly onCancel: () => void
}

/** The auto-detected tempo's state read-out + retry (corrections stay in the
 * tempo panel — this item only tells where the detection stands). */
export interface TempoDetectionControl {
  readonly bpm: number | undefined
  readonly detecting: boolean
  readonly error: TempoDetectionErrorCode | undefined
  /** Whether the last run was cancelled — the item then keeps an idle
   * « Détecter le tempo » face instead of vanishing (X.2). */
  readonly cancelled: boolean
  readonly onRetry: () => void
  /** Abort the in-flight detection (the busy face's « Annuler »). */
  readonly onCancel: () => void
}

/** The structure-detection surface the shell wires in. */
export interface StructureDetectionControl {
  readonly blockedReason: 'server' | undefined
  readonly detecting: boolean
  readonly error: StructureDetectionErrorCode | undefined
  readonly succeeded: boolean
  /** Whether STRUCTURE markers exist — a detection replaces them, so it
   * confirms. Hand-dropped cues survive a run, so they arm nothing. */
  readonly hasMarkers: boolean
  /** Whether a chord grid exists — a detection relabels it, so it confirms. */
  readonly hasGrid: boolean
  readonly onDetect: () => void
  /** Abort the in-flight detection (the busy face's « Annuler »). */
  readonly onCancel: () => void
  /** Whether the engine runs on the offload — the busy face then explains a
   * suspicious wait as a cold start (R.3), and a `network` failure names the
   * analysis service instead of the local server (X.1). */
  readonly offloaded: boolean
}

/** The chord-detection surface the shell wires in. */
export interface ChordDetectionControl {
  readonly blockedReason: 'server' | 'no-grid' | undefined
  readonly detecting: boolean
  readonly error: ChordDetectionErrorCode | undefined
  readonly succeeded: boolean
  /** Whether a grid already exists — the detected draft replaces it. */
  readonly hasGrid: boolean
  readonly onDetect: () => void
  /** Abort the in-flight detection (the busy face's « Annuler »). */
  readonly onCancel: () => void
}

interface AnalyserRowProps {
  /** Disables the manual actions until a track is loaded. */
  readonly disabled: boolean
  readonly separation: SeparationControl
  readonly tempo: TempoDetectionControl
  readonly structure: StructureDetectionControl
  readonly chords: ChordDetectionControl
}

/**
 * The head of the Analyse zone (Q.2): the four analysis actions — separate,
 * tempo, structure, chords — in one row, each item wearing its own state
 * (done / running / blocked / failed) through the shared DetectionAction
 * grammar. The row keeps a stable footprint: a finished separation shows a
 * « done » face instead of vanishing.
 */
export function AnalyserRow({
  disabled,
  separation,
  tempo,
  structure,
  chords
}: AnalyserRowProps) {
  const { t } = useLingui()

  // — Separation: idle/error → action; running → progress + cancel; ready →
  //   a quiet done face (the stems ARE the mixer, nothing left to offer).
  const sep = separation.state
  const sepRunning = sep.status === 'analysing' || sep.status === 'separating'
  const sepBlock = SEPARATION_SERVER_BLOCK[separation.serverHealth]
  const sepStep = sepRunning ? i18n._(PROGRESS_LABELS[sep.status]) : undefined
  const sepFailure =
    sep.status === 'error'
      ? i18n._({ ...SEP_FAILED, values: { error: sep.error } })
      : undefined
  // Steps while the run is in flight (never the moving percentage — spam),
  // completion once the stems are ready; failures interrupt via the
  // DetectionAction alert instead.
  const sepAnnounced = sep.status === 'ready' ? i18n._(DONE_LABEL) : sepStep

  // — Structure: the confirm names exactly the work at stake — both, the grid
  //   alone, or the markers alone (the S.3a wording, unchanged with no grid).
  const structureConfirm =
    structure.hasGrid && structure.hasMarkers
      ? t({
          id: 'structure.detect-confirm-both',
          message: 'Remplacer les repères de structure et la grille ?'
        })
      : structure.hasGrid
        ? t({
            id: 'structure.detect-confirm-grid',
            message: 'Réétiqueter la grille d’accords ?'
          })
        : t({
            id: 'structure.detect-confirm',
            message: 'Remplacer les repères de structure ?'
          })
  // `network` names what actually failed to answer: the offloaded analysis
  // service, or the local server (X.1).
  const structureErrorCopy =
    structure.error === 'network' && structure.offloaded
      ? STRUCTURE_OFFLOAD_UNREACHABLE
      : structure.error !== undefined
        ? STRUCTURE_ERROR_COPY[structure.error]
        : undefined
  const structureFailure =
    structureErrorCopy !== undefined
      ? `${t({
          id: 'structure.detect-failed',
          message: 'Échec de la détection de la structure'
        })} — ${t(structureErrorCopy)}`
      : undefined
  const structureAnnounced = structure.detecting
    ? t({ id: 'structure.detecting', message: 'Détection de la structure…' })
    : structure.succeeded
      ? t({
          id: 'structure.detect-done',
          message: 'Repères de structure posés depuis la détection'
        })
      : undefined

  // — Chords: mirrors structure, in the chord flow's words.
  const chordsHint =
    chords.blockedReason === 'server'
      ? t(CHORDS_NEEDS_SERVER)
      : chords.blockedReason === 'no-grid'
        ? t(CHORDS_NEEDS_GRID)
        : undefined
  const chordsFailure =
    chords.error !== undefined
      ? `${t({
          id: 'chords.detect-failed',
          message: 'Échec de la détection des accords'
        })} — ${t(CHORDS_ERROR_COPY[chords.error])}`
      : undefined
  const chordsAnnounced = chords.detecting
    ? t({ id: 'chords.detecting', message: 'Détection des accords…' })
    : chords.succeeded
      ? t({
          id: 'chords.detect-done',
          message: 'Grille pré-remplie depuis la détection'
        })
      : undefined

  return (
    <Cluster gap="var(--space-l)" align="flex-start">
      <div className={styles.item}>
        {sep.status === 'ready' ? (
          <p className={styles.done}>
            <Trans id="separation.done">Pistes séparées</Trans>
          </p>
        ) : (
          <DetectionAction
            label={
              sep.status === 'error'
                ? t({ id: 'separation.retry', message: 'Réessayer' })
                : t({ id: 'separation.separate', message: 'Séparer les pistes' })
            }
            runningLabel={sepStep}
            running={sepRunning}
            // The one flow with REAL progress (streamed NDJSON) — and the one
            // whose cancel already ships (R.2 wires the detections').
            progress={{ value: sep.progress, onCancel: separation.onCancel }}
            hint={sepBlock === undefined ? undefined : t(sepBlock)}
            errorLine={sepFailure}
            disabled={!separation.canSeparate || sepBlock !== undefined}
            onRun={separation.onSeparate}
          />
        )}
        {/* The announcement channel outlives the visible faces. */}
        <LiveStatus message={sepAnnounced} />
      </div>

      {(tempo.detecting ||
        tempo.error !== undefined ||
        tempo.bpm !== undefined ||
        tempo.cancelled) && (
        <div className={styles.item}>
          {tempo.error !== undefined ? (
            <DetectionAction
              label={t({ id: 'tempo.retry', message: 'Réessayer' })}
              runningLabel={t({
                id: 'analyser.tempo-detecting',
                message: 'Analyse du tempo…'
              })}
              running={tempo.detecting}
              progress={{ onCancel: tempo.onCancel }}
              errorLine={t(TEMPO_ERROR_COPY[tempo.error])}
              onRun={tempo.onRetry}
            />
          ) : tempo.detecting ? (
            <OperationStatus
              label={t({
                id: 'analyser.tempo-detecting',
                message: 'Analyse du tempo…'
              })}
              onCancel={tempo.onCancel}
            />
          ) : tempo.bpm !== undefined ? (
            <p className={styles.done}>
              <Trans id="analyser.tempo-done">Tempo détecté</Trans>
            </p>
          ) : (
            // Cancelled before any tempo landed (X.2): an idle face brings
            // the auto-detection back on offer — symmetric with the
            // structure/chords buttons that never vanish.
            <DetectionAction
              label={t({
                id: 'analyser.tempo-detect',
                message: 'Détecter le tempo'
              })}
              runningLabel={t({
                id: 'analyser.tempo-detecting',
                message: 'Analyse du tempo…'
              })}
              running={false}
              onRun={tempo.onRetry}
            />
          )}
        </div>
      )}

      <div className={styles.item}>
        <DetectionAction
          label={t({ id: 'structure.detect', message: 'Détecter la structure' })}
          runningLabel={t({
            id: 'structure.detecting-short',
            message: 'Détection…'
          })}
          running={structure.detecting}
          progress={{
            onCancel: structure.onCancel,
            // The wait becomes explained instead of worrying: after ~4 s the
            // line says the engine itself may be starting up.
            detail: structure.offloaded
              ? t({
                  id: 'structure.cold-start',
                  message:
                    "Démarrage du moteur d'analyse (jusqu'à ~1 min)…"
                })
              : undefined,
            detailAfterMs: 4000
          }}
          confirms={structure.hasMarkers || structure.hasGrid}
          confirmLabel={structureConfirm}
          hint={
            structure.blockedReason === 'server'
              ? t(STRUCTURE_NEEDS_SERVER)
              : undefined
          }
          errorLine={structureFailure}
          announcement={structureAnnounced}
          disabled={disabled || structure.blockedReason !== undefined}
          onRun={structure.onDetect}
        />
      </div>

      <div className={styles.item}>
        <DetectionAction
          label={t({ id: 'chords.detect', message: 'Détecter les accords' })}
          runningLabel={t({
            id: 'chords.detecting',
            message: 'Détection des accords…'
          })}
          running={chords.detecting}
          progress={{ onCancel: chords.onCancel }}
          confirms={chords.hasGrid}
          confirmLabel={t({
            id: 'chords.detect-confirm',
            message: 'Remplacer la grille ?'
          })}
          hint={chordsHint}
          errorLine={chordsFailure}
          announcement={chordsAnnounced}
          disabled={disabled || chords.blockedReason !== undefined}
          onRun={chords.onDetect}
        />
      </div>
    </Cluster>
  )
}
