import { buildTempoMap, measureIndexAt, type OctaveFactor } from '@app/core'
import { type ComponentProps, useMemo } from 'react'
import {
  type ExternalValue,
  useExternalValue
} from '../../lib/external-value.ts'
import { Stack } from '../../layout/stack/stack.tsx'
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
import type { useMarkers } from '../markers/use-markers.ts'
import type { useMixer } from '../mixer/use-mixer.ts'
import type { ServerHealth } from '../../projects/use-server-health.ts'
import { SeparationPanel } from '../separation/separation-panel.tsx'
import type { useSeparation } from '../separation/use-separation.ts'
import { TempoPanel } from '../tempo/tempo-panel.tsx'
import type { useTempo } from '../tempo/use-tempo.ts'
import type { useViewport } from '../waveform/use-viewport.ts'
import type { WaveformView } from '../waveform/waveform-view.tsx'
import { ShellStage } from './shell-stage.tsx'
import styles from './workstation-shell.module.css'

interface ShellMainProps {
  readonly isLoaded: boolean
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
}

/**
 * The workstation body: the timeline column (markers, zoomable stage, loops,
 * separation) beside the analysis panel.
 */
export function ShellMain({
  isLoaded,
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
  chordDetection
}: ShellMainProps) {
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

  return (
    <div className={styles.body}>
      <main className={styles.main}>
        <Stack gap="var(--space-m)">
          {/* The import → stems bridge sits at the top, by the import moment;
              once ready it steps aside and the stems become the mixer. */}
          <SeparationPanel
            state={separation.state}
            canSeparate={canSeparate}
            serverHealth={serverHealth}
            onSeparate={onSeparate}
            onCancel={separation.cancel}
          />
          <MarkerControls
            disabled={!isLoaded}
            onAdd={() => markers.addAt(position.get())}
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
          {isLoaded && (
            <TempoPanel
              bpm={tempo.analysis?.bpm}
              beatsPerBar={tempo.analysis?.beatsPerBar}
              tempoMap={tempoMap}
              position={position}
              detecting={tempo.detecting}
              error={tempo.error}
              octaveShift={tempo.octaveShift}
              manual={tempo.manual !== undefined}
              onFold={onFoldTempo}
              onRetry={onRetryTempo}
              onOverrideBpm={onOverrideBpm}
              onTap={onTapTempo}
              onAlignPhase={onAlignTempoPhase}
            />
          )}
          <LoopControls
            region={loopRegion}
            isSaved={loopEditing.isSaved}
            loopEnabled={loopEnabled}
            onToggleLoop={onToggleLoop}
            onSaveRegion={loopEditing.saveRegion}
            onClearRegion={loopEditing.clearRegion}
            trainer={speedTrainer}
          />
          {isLoaded && (
            <ChordChartPanel
              source={chordChart.source}
              onSourceChange={chordChart.setSource}
              onTranspose={chordChart.transpose}
              transposedBy={chordChart.transposedBy}
              pitchSemitones={pitchSemitones}
              header={chartHeader}
              currentMeasureIndex={currentMeasureIndex}
              detection={{
                detecting: chordDetection.detecting,
                error: chordDetection.error,
                succeeded: chordDetection.succeeded,
                onDetect: (barsPerRow) =>
                  void chordDetection.detect(barsPerRow),
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
