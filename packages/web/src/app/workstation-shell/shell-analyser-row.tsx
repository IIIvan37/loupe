import type { BeatGrid } from '@app/core'
import { isAnalysisOffloaded } from '../../audio/analysis-token.ts'
import type { ServerHealth } from '../../projects/use-server-health.ts'
import { AnalyserRow } from '../analyser/analyser-row.tsx'
import type { ChordDetection } from '../lead-sheet/use-chord-detection.ts'
import type { StructureDetection } from '../markers/use-structure-detection.ts'
import type { useSeparation } from '../separation/use-separation.ts'
import type { useTempo } from '../tempo/use-tempo.ts'
import { useOnline } from './use-online.ts'

interface ShellAnalyserRowProps {
  /** Disables the manual actions until a track is loaded. */
  readonly disabled: boolean
  readonly separation: ReturnType<typeof useSeparation>
  readonly canSeparate: boolean
  readonly serverHealth: ServerHealth
  readonly onSeparate: () => void
  readonly tempo: ReturnType<typeof useTempo>
  /** Relaunch a failed/cancelled tempo detection (the idle/error faces). */
  readonly onRetryTempo: () => void
  readonly structureDetection: StructureDetection
  /** Whether STRUCTURE markers exist — a detection replaces them. */
  readonly hasStructureMarkers: boolean
  /** Whether a chord grid exists — a detection replaces/relabels it. */
  readonly hasChartSource: boolean
  readonly grid: BeatGrid | undefined
  readonly chordDetection: ChordDetection
}

/**
 * The shell's mapping of the four analysis flows onto the AnalyserRow
 * controls — where each item's gating policy lives: the local health probe
 * only gates the LOCAL engines (X.1, extended to tempo/chords in M1.1 — no
 * Modal probe: a page-load probe would cold-start the billed container, so
 * errors speak at click time instead).
 */
export function ShellAnalyserRow({
  disabled,
  separation,
  canSeparate,
  serverHealth,
  onSeparate,
  tempo,
  onRetryTempo,
  structureDetection,
  hasStructureMarkers,
  hasChartSource,
  grid,
  chordDetection
}: ShellAnalyserRowProps) {
  const offloaded = isAnalysisOffloaded()
  const online = useOnline()
  // 'checking' blocks the local path too — a transient flash beats an upload
  // the server can't take.
  const localServerDown =
    serverHealth === 'offline' || serverHealth === 'checking'
  // The measures always need a downbeat-flagged grid to anchor on; locally
  // the chord engine only needs the server to ANSWER (it runs on CPU —
  // 'no-separation' just means no Demucs device).
  const hasDownbeat = grid?.some((beat) => beat.downbeat) ?? false
  return (
    <AnalyserRow
      disabled={disabled}
      online={online}
      separation={{
        state: separation.state,
        canSeparate,
        serverHealth,
        onSeparate,
        onCancel: separation.cancel,
        offloaded
      }}
      tempo={{
        bpm: tempo.analysis?.bpm,
        detecting: tempo.detecting,
        error: tempo.error,
        // A gate-blocked run (offload, M1.1) is no more a dead end than a
        // cancel (X.2): the same idle « Détecter le tempo » face keeps the
        // relaunch on offer while the account menu explains.
        cancelled: tempo.cancelled || tempo.gateReason !== undefined,
        onRetry: onRetryTempo,
        onCancel: tempo.cancelDetection,
        offloaded
      }}
      structure={{
        detecting: structureDetection.detecting,
        error: structureDetection.error,
        succeeded: structureDetection.succeeded,
        // A detection replaces the STRUCTURE markers AND, when one exists,
        // relabels the grid — either is armed work, so the confirm arms on
        // both. Hand-dropped cues survive a run, so they arm nothing. The
        // relabel needs a beat grid to place the sections on, so a grid is
        // only "at stake" once the tempo is known (matches the guard in
        // useStructureMarkers), never over-promising the confirm.
        hasMarkers: hasStructureMarkers,
        hasGrid: hasChartSource && hasDownbeat,
        onDetect: () => void structureDetection.detect(),
        onCancel: structureDetection.cancel,
        offloaded,
        blockedReason: !offloaded && localServerDown ? 'server' : undefined
      }}
      chords={{
        detecting: chordDetection.detecting,
        error: chordDetection.error,
        succeeded: chordDetection.succeeded,
        hasGrid: hasChartSource,
        // No layout arg: the hook falls back to the stored preference.
        onDetect: () => void chordDetection.detect(),
        onCancel: chordDetection.cancel,
        offloaded,
        blockedReason:
          !offloaded && localServerDown
            ? 'server'
            : hasDownbeat
              ? undefined
              : 'no-grid'
      }}
    />
  )
}
