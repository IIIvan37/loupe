import { buildTempoMap, measureIndexAt, type OctaveFactor } from '@app/core'
import { isAnalysisOffloaded } from '../../audio/analysis-token.ts'
import { useLingui } from '@lingui/react/macro'
import { type ComponentProps, useMemo } from 'react'
import {
  type ExternalValue,
  useExternalValue
} from '../../lib/external-value.ts'
import { Stack } from '../../layout/stack/stack.tsx'
import { AnalyserRow } from '../analyser/analyser-row.tsx'
import { analysisSummary } from '../analyser/analysis-summary.ts'
import type { AnalysisFold } from '../analyser/use-analysis-fold.ts'
import { AnalysisPanel } from '../analysis-panel/analysis-panel.tsx'
import type { ChartHeaderData } from '../lead-sheet/chart-header.tsx'
import { ChordChartPanel } from '../lead-sheet/chord-chart-panel.tsx'
import type { ChordChartState } from '../lead-sheet/use-chord-chart.ts'
import type { ChordDetection } from '../lead-sheet/use-chord-detection.ts'
import { LoopControls } from '../loops/loop-controls.tsx'
import type { useLoopEditing } from '../loops/use-loop-editing.ts'
import type { useLoops } from '../loops/use-loops.ts'
import type { SpeedTrainer } from '../loops/use-speed-trainer.ts'
import { MarkerControls } from '../markers/marker-controls.tsx'
import type { StructureDetection } from '../markers/use-structure-detection.ts'
import type { useMarkers } from '../markers/use-markers.ts'
import type { useMixer } from '../mixer/use-mixer.ts'
import type { ServerHealth } from '../../projects/use-server-health.ts'
import type { useSeparation } from '../separation/use-separation.ts'
import { TempoPanel } from '../tempo/tempo-panel.tsx'
import type { useTempo } from '../tempo/use-tempo.ts'
import type { useViewport } from '../waveform/use-viewport.ts'
import type { WaveformView } from '../waveform/waveform-view.tsx'
import { ShellSection } from './shell-section.tsx'
import { ShellStage } from './shell-stage.tsx'
import styles from './workstation-shell.module.css'

interface ShellMainProps {
  readonly isLoaded: boolean
  /** Whether the Analyse zone is unfolded — owned by the shell (Q.3). */
  readonly analysisFold: AnalysisFold
  /** The playhead, streamed outside React state (Lot L.1). */
  readonly position: ExternalValue<number>
  readonly durationSeconds: number
  readonly markers: ReturnType<typeof useMarkers>
  readonly viewport: ReturnType<typeof useViewport>
  readonly mixer: ReturnType<typeof useMixer>
  readonly loops: ReturnType<typeof useLoops>
  readonly loopEditing: ReturnType<typeof useLoopEditing>
  readonly separation: ReturnType<typeof useSeparation>
  readonly tempo: ReturnType<typeof useTempo>
  /** Download one mixer lane as a WAV (synthetic lanes + separated stems). */
  readonly onDownloadStem: (id: string) => void
  readonly mainViewState: ComponentProps<typeof WaveformView>['state']
  readonly loopRegion: ComponentProps<typeof WaveformView>['loopRegion']
  readonly loopEnabled: boolean
  readonly onToggleLoop: () => void
  /** The speed-trainer ramp riding the loupe (loop controls). */
  readonly speedTrainer: SpeedTrainer
  readonly onSeekSeconds: (seconds: number) => void
  readonly onSeekRatio: (ratio: number) => void
  /** Fold the detected tempo an octave (×2 / ÷2) and re-seat the click. */
  readonly onFoldTempo: (factor: OctaveFactor) => void
  /** Relaunch a failed tempo detection (the panel's « Réessayer »). */
  readonly onRetryTempo: () => void
  /** Set the tempo by hand from the panel's BPM field. */
  readonly onOverrideBpm: (bpm: number) => void
  /** Correct the meter from the panel's beats-per-bar field. */
  readonly onOverrideMeter: (beatsPerBar: number) => void
  /** One tap of the panel's tap-tempo sequence. */
  readonly onTapTempo: () => void
  /** Anchor a downbeat on the playhead (the panel's « Caler »). */
  readonly onAlignTempoPhase: (playheadSeconds: number) => void
  /** Reopen the file picker — the way out of a failed import. */
  readonly onReimport: () => void
  readonly canSeparate: boolean
  readonly serverHealth: ServerHealth
  readonly onSeparate: () => void
  /** The chord chart's session state (text + key offset), lifted to the shell. */
  readonly chordChart: Pick<
    ChordChartState,
    'source' | 'transposedBy' | 'setSource' | 'transpose'
  >
  /** The live audio pitch shift — the key the ear hears the track in. */
  readonly pitchSemitones: number
  /** What the session derives for the chart head (tags, BPM, bar length). */
  readonly chartHeader: ChartHeaderData
  /** « Détecter les accords » — the chord-detection flow the panel drives. */
  readonly chordDetection: ChordDetection
  /** « Détecter la structure » — the flow that places section markers. */
  readonly structureDetection: StructureDetection
}

/**
 * The workstation body: the timeline column (markers, zoomable stage, loops,
 * separation) beside the analysis panel.
 */
export function ShellMain({
  isLoaded,
  analysisFold,
  position,
  durationSeconds,
  markers,
  viewport,
  mixer,
  loops,
  loopEditing,
  separation,
  tempo,
  onDownloadStem,
  mainViewState,
  loopRegion,
  loopEnabled,
  onToggleLoop,
  speedTrainer,
  onSeekSeconds,
  onFoldTempo,
  onRetryTempo,
  onOverrideBpm,
  onOverrideMeter,
  onTapTempo,
  onAlignTempoPhase,
  onReimport,
  onSeekRatio,
  canSeparate,
  serverHealth,
  onSeparate,
  chordChart,
  pitchSemitones,
  chartHeader,
  chordDetection,
  structureDetection
}: ShellMainProps) {
  const { t } = useLingui()
  // Stems the separation masked as near-silent — captioned in the mixer gutter.
  const undetectedStems =
    separation.state.status === 'ready'
      ? separation.state.stems.filter((stem) => !stem.present)
      : []

  // The tempo over time, re-derived from the beat grid (the persisted source of
  // truth) — a linear pass over a few hundred beats, memoised per grid.
  const grid = tempo.analysis?.grid
  const tempoMap = useMemo(() => buildTempoMap(grid ?? []), [grid])

  // The played measure is a projection of the playhead on the grid's downbeats
  // — derived, never stored. Subscribing to the INDEX (an integer) re-renders
  // this column once per measure, not per animation frame.
  const currentMeasureIndex = useExternalValue(position, (seconds) =>
    measureIndexAt(grid ?? [], seconds)
  )

  // What the machine acquired, for the folded Analyse header (Q.3).
  const structureSections = markers.markers.filter(
    (marker) => marker.kind === 'structure'
  ).length
  const chartSource = chordChart.source
  const folded = !analysisFold.open
  const summary = useMemo(
    () =>
      // Only the FOLDED header shows it — don't parse the chart per keystroke
      // while the zone is open and the summary would be discarded anyway.
      folded
        ? analysisSummary({
            separated: separation.state.status === 'ready',
            bpm: tempo.analysis?.bpm,
            beatsPerBar: tempo.analysis?.beatsPerBar,
            sectionCount: structureSections,
            chartSource
          })
        : undefined,
    [
      folded,
      separation.state.status,
      tempo.analysis,
      structureSections,
      chartSource
    ]
  )

  return (
    <div className={styles.body}>
      <main className={styles.main}>
        {/* Q.1 — the column is three named zones, not a flat pile of panels:
            Timeline (the material), Analyse (what the machine derives from
            it), Partition (the chart). Wide gaps separate zones, tight gaps
            group their rows — the spacing IS the hierarchy. */}
        <Stack gap="var(--space-l)">
          <ShellSection
            label={t({ id: 'shell.zone.timeline', message: 'Timeline' })}
          >
            <MarkerControls
            disabled={!isLoaded}
            onAdd={() => markers.addAt(position.get())}
            onAddSection={() => markers.addSectionAt(position.get())}
          />
          <ShellStage
            isLoaded={isLoaded}
            position={position}
            durationSeconds={durationSeconds}
            viewport={viewport}
            mixer={mixer}
            undetectedStems={undetectedStems}
            onDownloadStem={onDownloadStem}
            markers={markers}
            loopEditing={loopEditing}
            beatGrid={tempo.analysis?.grid ?? []}
            mainViewState={mainViewState}
            loopRegion={loopRegion}
            loopEnabled={loopEnabled}
            onSeekSeconds={onSeekSeconds}
            onSeekRatio={onSeekRatio}
            onReimport={onReimport}
          />
          <LoopControls
            region={loopRegion}
            isSaved={loopEditing.isSaved}
            loopEnabled={loopEnabled}
            onToggleLoop={onToggleLoop}
            onSaveRegion={loopEditing.saveRegion}
            onClearRegion={loopEditing.clearRegion}
            trainer={speedTrainer}
          />
          </ShellSection>
          <ShellSection
            label={t({ id: 'shell.zone.analysis', message: 'Analyse' })}
            fold={{
              open: analysisFold.open,
              onToggle: analysisFold.toggle,
              summary
            }}
          >
          {/* Q.2 — the four analysis actions in one row, each wearing its own
              state. The row is the import → analyses bridge; the panels below
              carry only the results and their corrections. */}
          <AnalyserRow
            disabled={!isLoaded}
            separation={{
              state: separation.state,
              canSeparate,
              serverHealth,
              onSeparate,
              onCancel: separation.cancel
            }}
            tempo={{
              bpm: tempo.analysis?.bpm,
              detecting: tempo.detecting,
              error: tempo.error,
              onRetry: onRetryTempo,
              onCancel: tempo.cancelDetection
            }}
            structure={{
              detecting: structureDetection.detecting,
              error: structureDetection.error,
              succeeded: structureDetection.succeeded,
              // A detection replaces the STRUCTURE markers AND, when one
              // exists, relabels the grid — either is armed work, so the
              // confirm arms on both. Hand-dropped cues survive a run, so they
              // arm nothing. The relabel needs a beat grid to place the
              // sections on, so a grid is only "at stake" once the tempo is
              // known (matches the guard in useStructureMarkers), never
              // over-promising the confirm.
              hasMarkers: markers.markers.some(
                (marker) => marker.kind === 'structure'
              ),
              hasGrid:
                chordChart.source.trim().length > 0 &&
                (grid ?? []).some((beat) => beat.downbeat),
              onDetect: () => void structureDetection.detect(),
              onCancel: structureDetection.cancel,
              mayColdStart: isAnalysisOffloaded(),
              // The structure engine only needs the server to ANSWER (it runs
              // on CPU); no grid is required, so 'server' is the only block.
              blockedReason:
                serverHealth === 'offline' || serverHealth === 'checking'
                  ? 'server'
                  : undefined
            }}
            chords={{
              detecting: chordDetection.detecting,
              error: chordDetection.error,
              succeeded: chordDetection.succeeded,
              hasGrid: chordChart.source.trim().length > 0,
              // No layout arg: the hook falls back to the stored preference.
              onDetect: () => void chordDetection.detect(),
              onCancel: chordDetection.cancel,
              // The chord engine only needs the server to ANSWER (it runs
              // on CPU — 'no-separation' just means no Demucs device), and
              // the measures need a downbeat-flagged grid to anchor on.
              blockedReason:
                serverHealth === 'offline' || serverHealth === 'checking'
                  ? 'server'
                  : (grid?.some((beat) => beat.downbeat) ?? false)
                    ? undefined
                    : 'no-grid'
            }}
          />
          {isLoaded && (
            <TempoPanel
              bpm={tempo.analysis?.bpm}
              beatsPerBar={tempo.analysis?.beatsPerBar}
              tempoMap={tempoMap}
              position={position}
              detecting={tempo.detecting}
              octaveShift={tempo.octaveShift}
              manual={tempo.manual !== undefined}
              onFold={onFoldTempo}
              onOverrideBpm={onOverrideBpm}
              onOverrideMeter={onOverrideMeter}
              onTap={onTapTempo}
              onAlignPhase={onAlignTempoPhase}
            />
          )}
          </ShellSection>
          {isLoaded && (
            <ShellSection
              label={t({ id: 'shell.zone.chart', message: 'Partition' })}
            >
            <ChordChartPanel
              source={chordChart.source}
              onSourceChange={chordChart.setSource}
              onTranspose={chordChart.transpose}
              transposedBy={chordChart.transposedBy}
              pitchSemitones={pitchSemitones}
              header={chartHeader}
              currentMeasureIndex={currentMeasureIndex}
            />
            </ShellSection>
          )}
        </Stack>
      </main>

      <div className={styles.panelSlot}>
        <AnalysisPanel
          markers={markers.markers}
          onSeekMarker={onSeekSeconds}
          onRenameMarker={markers.rename}
          onRemoveMarker={markers.remove}
          loops={loops.library}
          activeLoopId={loopEditing.activeLoopId}
          onActivateLoop={loopEditing.activate}
          onUpdateLoop={loops.update}
          onRemoveLoop={loopEditing.remove}
        />
      </div>
    </div>
  )
}
