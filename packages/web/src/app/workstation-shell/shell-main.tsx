import { buildTempoMap, type OctaveFactor } from '@app/core'
import { type ComponentProps, useMemo } from 'react'
import { Stack } from '../../layout/stack/stack.tsx'
import { AnalysisPanel } from '../analysis-panel/analysis-panel.tsx'
import { LoopControls } from '../loops/loop-controls.tsx'
import type { useLoopEditing } from '../loops/use-loop-editing.ts'
import type { useLoops } from '../loops/use-loops.ts'
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
  readonly positionRatio: number
  readonly positionSeconds: number
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
  readonly onSeekSeconds: (seconds: number) => void
  readonly onSeekRatio: (ratio: number) => void
  /** Fold the detected tempo an octave (×2 / ÷2) and re-seat the click. */
  readonly onFoldTempo: (factor: OctaveFactor) => void
  /** Relaunch a failed tempo detection (the panel's « Réessayer »). */
  readonly onRetryTempo: () => void
  /** Reopen the file picker — the way out of a failed import. */
  readonly onReimport: () => void
  readonly canSeparate: boolean
  readonly serverHealth: ServerHealth
  readonly onSeparate: () => void
}

/**
 * The workstation body: the timeline column (markers, zoomable stage, loops,
 * separation) beside the analysis panel.
 */
export function ShellMain({
  isLoaded,
  positionRatio,
  positionSeconds,
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
  onSeekSeconds,
  onFoldTempo,
  onRetryTempo,
  onReimport,
  onSeekRatio,
  canSeparate,
  serverHealth,
  onSeparate
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
          />
          <MarkerControls
            disabled={!isLoaded}
            onAdd={() => markers.addAt(positionSeconds)}
          />
          <ShellStage
            isLoaded={isLoaded}
            positionRatio={positionRatio}
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
              positionSeconds={positionSeconds}
              detecting={tempo.detecting}
              error={tempo.error}
              octaveShift={tempo.octaveShift}
              onFold={onFoldTempo}
              onRetry={onRetryTempo}
            />
          )}
          <LoopControls
            region={loopRegion}
            isSaved={loopEditing.isSaved}
            loopEnabled={loopEnabled}
            onToggleLoop={onToggleLoop}
            onSaveRegion={loopEditing.saveRegion}
            onClearRegion={loopEditing.clearRegion}
          />
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
