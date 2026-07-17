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
  ANALYSIS_OFFLINE,
  ANALYSIS_OFFLOAD_UNREACHABLE,
  CHORDS_ERROR_COPY,
  CHORDS_NEEDS_GRID,
  CHORDS_NEEDS_SERVER,
  SEPARATION_ERROR_COPY,
  SEPARATION_SERVER_BLOCK,
  STRUCTURE_ERROR_COPY,
  STRUCTURE_NEEDS_SERVER,
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

/** The R.3 cold-start narration, shared by the offloaded busy faces (M1.1). */
const ANALYSIS_COLD_START = msg({
  id: 'analysis.cold-start',
  message: "Démarrage du moteur d'analyse (jusqu'à ~1 min)…"
})

/** Offline only blocks what actually needs the network: the OFFLOADED flows
    (M1.4). The local engines live on localhost and keep working. */
function offlineBlocks(offloaded: boolean, online: boolean): boolean {
  return offloaded && !online
}

/** The X.1 rule every flow shares (M1.1/M1.4): a `network` failure names what
    actually failed to answer — the offloaded analysis service, or the local
    server the table's own copy points at. */
function errorCopyFor<Code extends string>(
  error: Code | undefined,
  offloaded: boolean,
  table: Readonly<Record<Code, MessageDescriptor>>
): MessageDescriptor | undefined {
  if (error === undefined) return undefined
  if (error === 'network' && offloaded) return ANALYSIS_OFFLOAD_UNREACHABLE
  return table[error]
}

/** The separation surface, unchanged from the retired SeparationPanel. */
export interface SeparationControl {
  readonly state: SeparationState
  readonly canSeparate: boolean
  readonly serverHealth: ServerHealth
  readonly onSeparate: () => void
  readonly onCancel: () => void
  /** Whether the engine runs on the offload — the local health probe then
   * stops gating the action (M1.3, same rule as the three detections). */
  readonly offloaded: boolean
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
  /** Whether the engine runs on the offload — a `network` failure then names
   * the analysis service instead of the local server (M1.1, extends X.1). */
  readonly offloaded: boolean
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
  /** Whether the engine runs on the offload — the busy face then explains a
   * suspicious wait as a cold start (R.3), and a `network` failure names the
   * analysis service instead of the local server (M1.1, extends X.1). */
  readonly offloaded: boolean
}

interface AnalyserRowProps {
  /** Disables the manual actions until a track is loaded. */
  readonly disabled: boolean
  /** Whether the browser sees a network. Offline only gates the OFFLOADED
   * flows (M1.4) — the local server lives on localhost and keeps working. */
  readonly online: boolean
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
  online,
  separation,
  tempo,
  structure,
  chords
}: AnalyserRowProps) {
  const showTempo =
    tempo.detecting ||
    tempo.error !== undefined ||
    tempo.bpm !== undefined ||
    tempo.cancelled
  return (
    <Cluster gap="var(--space-l)" align="flex-start">
      <SeparationItem separation={separation} online={online} />
      {showTempo && <TempoItem tempo={tempo} online={online} />}
      <StructureItem structure={structure} disabled={disabled} online={online} />
      <ChordsItem chords={chords} disabled={disabled} online={online} />
    </Cluster>
  )
}

/** Separation: idle/error → action; running → progress + cancel; ready → a
    quiet done face (the stems ARE the mixer, nothing left to offer). */
function SeparationItem({
  separation,
  online
}: {
  readonly separation: SeparationControl
  readonly online: boolean
}) {
  const { t } = useLingui()
  const sep = separation.state
  const running = sep.status === 'analysing' || sep.status === 'separating'
  // Offloaded, « démarrer le serveur local » would be the wrong remedy: the
  // local probe only gates the LOCAL engine (M1.3, extends X.1) — offline
  // gates the offload instead (M1.4).
  let block: MessageDescriptor | undefined
  if (separation.offloaded) {
    block = offlineBlocks(true, online) ? ANALYSIS_OFFLINE : undefined
  } else {
    block = SEPARATION_SERVER_BLOCK[separation.serverHealth]
  }
  const step = running ? i18n._(PROGRESS_LABELS[sep.status]) : undefined
  const errorCopy = errorCopyFor(
    sep.error?.code,
    separation.offloaded,
    SEPARATION_ERROR_COPY
  )
  const failure =
    errorCopy !== undefined
      ? `${t({
          id: 'separation.detect-failed',
          message: 'Échec de la séparation'
        })} — ${t(errorCopy)}`
      : undefined
  // Steps while the run is in flight (never the moving percentage — spam),
  // completion once the stems are ready; failures interrupt via the
  // DetectionAction alert instead.
  const announced = sep.status === 'ready' ? i18n._(DONE_LABEL) : step
  return (
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
          runningLabel={step}
          running={running}
          // The one flow with REAL progress (streamed NDJSON) — and the one
          // whose cancel already ships (R.2 wires the detections'). The
          // cold-start narration rides the real bar (M1.4, extends R.3).
          progress={{
            value: sep.progress,
            onCancel: separation.onCancel,
            detail: separation.offloaded ? t(ANALYSIS_COLD_START) : undefined,
            detailAfterMs: 4000
          }}
          hint={block === undefined ? undefined : t(block)}
          errorLine={failure}
          disabled={!separation.canSeparate || block !== undefined}
          onRun={separation.onSeparate}
        />
      )}
      {/* The announcement channel outlives the visible faces. */}
      <LiveStatus message={announced} />
    </div>
  )
}

/** Tempo: error → retry; running → progress; landed → done face; cancelled
    before any tempo landed (X.2) → an idle face brings the auto-detection
    back on offer — symmetric with the structure/chords buttons that never
    vanish. Offline blocks the relaunch like its offloaded neighbours (M1.4). */
function TempoItem({
  tempo,
  online
}: {
  readonly tempo: TempoDetectionControl
  readonly online: boolean
}) {
  const { t } = useLingui()
  const runningLabel = t({
    id: 'analyser.tempo-detecting',
    message: 'Analyse du tempo…'
  })
  if (tempo.error !== undefined) {
    const errorCopy = errorCopyFor(
      tempo.error,
      tempo.offloaded,
      TEMPO_ERROR_COPY
    ) as MessageDescriptor
    return (
      <div className={styles.item}>
        <DetectionAction
          label={t({ id: 'tempo.retry', message: 'Réessayer' })}
          runningLabel={runningLabel}
          running={tempo.detecting}
          progress={{ onCancel: tempo.onCancel }}
          errorLine={t(errorCopy)}
          onRun={tempo.onRetry}
        />
      </div>
    )
  }
  if (tempo.detecting) {
    return (
      <div className={styles.item}>
        <OperationStatus label={runningLabel} onCancel={tempo.onCancel} />
      </div>
    )
  }
  if (tempo.bpm !== undefined) {
    return (
      <div className={styles.item}>
        <p className={styles.done}>
          <Trans id="analyser.tempo-done">Tempo détecté</Trans>
        </p>
      </div>
    )
  }
  return (
    <div className={styles.item}>
      <DetectionAction
        label={t({ id: 'analyser.tempo-detect', message: 'Détecter le tempo' })}
        runningLabel={runningLabel}
        running={false}
        disabled={offlineBlocks(tempo.offloaded, online)}
        onRun={tempo.onRetry}
      />
    </div>
  )
}

/** Structure: the confirm names exactly the work at stake — both, the grid
    alone, or the markers alone (the S.3a wording, unchanged with no grid). */
function StructureItem({
  structure,
  disabled,
  online
}: {
  readonly structure: StructureDetectionControl
  readonly disabled: boolean
  readonly online: boolean
}) {
  const { t } = useLingui()
  let confirm = t({
    id: 'structure.detect-confirm',
    message: 'Remplacer les repères de structure ?'
  })
  if (structure.hasGrid) {
    confirm = structure.hasMarkers
      ? t({
          id: 'structure.detect-confirm-both',
          message: 'Remplacer les repères de structure et la grille ?'
        })
      : t({
          id: 'structure.detect-confirm-grid',
          message: 'Réétiqueter la grille d’accords ?'
        })
  }
  const errorCopy = errorCopyFor(
    structure.error,
    structure.offloaded,
    STRUCTURE_ERROR_COPY
  )
  const failure =
    errorCopy !== undefined
      ? `${t({
          id: 'structure.detect-failed',
          message: 'Échec de la détection de la structure'
        })} — ${t(errorCopy)}`
      : undefined
  let announced: string | undefined
  if (structure.detecting) {
    announced = t({
      id: 'structure.detecting',
      message: 'Détection de la structure…'
    })
  } else if (structure.succeeded) {
    announced = t({
      id: 'structure.detect-done',
      message: 'Repères de structure posés depuis la détection'
    })
  }
  let hint: string | undefined
  if (offlineBlocks(structure.offloaded, online)) {
    hint = t(ANALYSIS_OFFLINE)
  } else if (structure.blockedReason === 'server') {
    hint = t(STRUCTURE_NEEDS_SERVER)
  }
  return (
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
          detail: structure.offloaded ? t(ANALYSIS_COLD_START) : undefined,
          detailAfterMs: 4000
        }}
        confirms={structure.hasMarkers || structure.hasGrid}
        confirmLabel={confirm}
        hint={hint}
        errorLine={failure}
        announcement={announced}
        disabled={
          disabled ||
          structure.blockedReason !== undefined ||
          offlineBlocks(structure.offloaded, online)
        }
        onRun={structure.onDetect}
      />
    </div>
  )
}

/** Chords: mirrors structure, in the chord flow's words. Offline speaks
    first: no grid is beside the point when nothing can run anyway. */
function ChordsItem({
  chords,
  disabled,
  online
}: {
  readonly chords: ChordDetectionControl
  readonly disabled: boolean
  readonly online: boolean
}) {
  const { t } = useLingui()
  let hint: string | undefined
  if (offlineBlocks(chords.offloaded, online)) {
    hint = t(ANALYSIS_OFFLINE)
  } else if (chords.blockedReason === 'server') {
    hint = t(CHORDS_NEEDS_SERVER)
  } else if (chords.blockedReason === 'no-grid') {
    hint = t(CHORDS_NEEDS_GRID)
  }
  const errorCopy = errorCopyFor(
    chords.error,
    chords.offloaded,
    CHORDS_ERROR_COPY
  )
  const failure =
    errorCopy !== undefined
      ? `${t({
          id: 'chords.detect-failed',
          message: 'Échec de la détection des accords'
        })} — ${t(errorCopy)}`
      : undefined
  let announced: string | undefined
  if (chords.detecting) {
    announced = t({ id: 'chords.detecting', message: 'Détection des accords…' })
  } else if (chords.succeeded) {
    announced = t({
      id: 'chords.detect-done',
      message: 'Grille pré-remplie depuis la détection'
    })
  }
  return (
    <div className={styles.item}>
      <DetectionAction
        label={t({ id: 'chords.detect', message: 'Détecter les accords' })}
        runningLabel={t({
          id: 'chords.detecting',
          message: 'Détection des accords…'
        })}
        running={chords.detecting}
        progress={{
          onCancel: chords.onCancel,
          // Same R.3 narration as structure: a suspicious offloaded wait
          // reads as the engine starting up, not as a hang.
          detail: chords.offloaded ? t(ANALYSIS_COLD_START) : undefined,
          detailAfterMs: 4000
        }}
        confirms={chords.hasGrid}
        confirmLabel={t({
          id: 'chords.detect-confirm',
          message: 'Remplacer la grille ?'
        })}
        hint={hint}
        errorLine={failure}
        announcement={announced}
        disabled={
          disabled ||
          chords.blockedReason !== undefined ||
          offlineBlocks(chords.offloaded, online)
        }
        onRun={chords.onDetect}
      />
    </div>
  )
}
