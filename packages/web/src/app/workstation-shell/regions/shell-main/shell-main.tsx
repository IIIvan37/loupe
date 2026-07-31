import {
  buildTempoMap,
  makeLoopRegion,
  type Marker,
  measureIndexAt,
  measureSeekTime
} from '@app/core'
import { useLingui } from '@lingui/react/macro'
import { useAtomValue } from 'jotai'
import { useMemo } from 'react'
import { useExternalValue } from '../../../../lib/external-value.ts'
import { Stack } from '../../../../layout/stack/stack.tsx'
import { AnalysisGateNotice } from '../../../account/analysis-gate-notice/analysis-gate-notice.tsx'
import { analysisSummary } from '../../../analyser/analysis-summary.ts'
import type { AnalysisFold } from '../../../analyser/use-analysis-fold.ts'
import { AnalysisPanel } from '../../../analysis-panel/analysis-panel.tsx'
import { usePlayerHandle } from '../../../audio-session/audio-session.ts'
import type { ChartHeaderData } from '../../../lead-sheet/chart-header/chart-header.tsx'
import { ChordChartPanel } from '../../../lead-sheet/chord-chart-panel/chord-chart-panel.tsx'
import type { ChordChartState } from '../../../lead-sheet/use-chord-chart.ts'
import type { ChordDetection } from '../../../lead-sheet/use-chord-detection.ts'
import { LoopControls } from '../../../loops/loop-controls/loop-controls.tsx'
import { speedTrainerStateAtom } from '../../../loops/speed-trainer-atoms.ts'
import { useLoopEditing } from '../../../loops/use-loop-editing.ts'
import { useLoops } from '../../../loops/use-loops.ts'
import { MarkerControls } from '../../../markers/marker-controls/marker-controls.tsx'
import { markerSections } from '../../../markers/section-markers.ts'
import type { StructureDetection } from '../../../markers/use-structure-detection.ts'
import { useMarkers } from '../../../markers/use-markers.ts'
import { useSeparation } from '../../../separation/use-separation.ts'
import { countingInAtom } from '../../../tempo/tempo-atoms.ts'
import { TempoPanel } from '../../../tempo/tempo-panel/tempo-panel.tsx'
import { useTempo } from '../../../tempo/use-tempo.ts'
import {
  importStateAtom,
  loopEnabledAtom,
  loopRegionAtom,
  pitchSemitonesAtom,
  transportAtom
} from '../../../waveform/player-atoms.ts'
import { ShellAnalyserRow } from '../shell-analyser-row.tsx'
import { ShellSection } from '../shell-section/shell-section.tsx'
import { ShellStage } from '../shell-stage/shell-stage.tsx'
import type { TempoDetection } from '../../../tempo/use-tempo-detection.ts'
import styles from './shell-main.module.css'

interface ShellMainProps {
  /** Whether the Analyse zone is unfolded — owned by the shell (Q.3). */
  readonly analysisFold: AnalysisFold
  /** Download one mixer lane as a WAV (synthetic lanes + separated stems). */
  readonly onDownloadStem: (id: string) => void
  /** The tempo corrections the panel drives (fold, BPM, meter, tap, phase) —
   * each re-seats the metronome click, which is the shell's wiring. */
  readonly tempoDetection: TempoDetection
  /** Reopen the file picker — the way out of a failed import. */
  readonly onReimport: () => void
  readonly canSeparate: boolean
  readonly onSeparate: () => void
  /** The chord chart's session state (text + key offset), lifted to the shell. */
  readonly chordChart: Pick<
    ChordChartState,
    'source' | 'transposedBy' | 'setSource' | 'transpose'
  >
  /** What the session derives for the chart head (tags, BPM, bar length). */
  readonly chartHeader: ChartHeaderData
  /** « Détecter les accords » — the chord-detection flow the panel drives. */
  readonly chordDetection: ChordDetection
  /** « Détecter la structure » — the flow that places section markers. */
  readonly structureDetection: StructureDetection
}

/**
 * The workstation body: the timeline column (markers, zoomable stage, loops,
 * separation) beside the analysis panel. A smart region (ADR 0011): the
 * player it renders — playhead, transport, loupe, pitch, trainer — is
 * reached through the session and the player's atoms, never threaded down.
 */
export function ShellMain({
  analysisFold,
  onDownloadStem,
  tempoDetection,
  onReimport,
  canSeparate,
  onSeparate,
  chordChart,
  chartHeader,
  chordDetection,
  structureDetection
}: ShellMainProps) {
  const { t } = useLingui()
  const player = usePlayerHandle()
  const markers = useMarkers()
  // The region wears the session tempo, separation and loops itself
  // (ADR 0010) — same atoms as the shell's instances; only the click
  // re-seating and the stems → mixer wiring stay upstairs.
  const tempo = useTempo()
  const separation = useSeparation()
  const loops = useLoops()
  const loopEditing = useLoopEditing()
  const importState = useAtomValue(importStateAtom)
  const transport = useAtomValue(transportAtom)
  const loopRegion = useAtomValue(loopRegionAtom)
  const loopEnabled = useAtomValue(loopEnabledAtom)
  const pitchSemitones = useAtomValue(pitchSemitonesAtom)
  const countingIn = useAtomValue(countingInAtom)
  const trainerState = useAtomValue(speedTrainerStateAtom)
  const isLoaded = importState.status === 'loaded'
  // During the count-in the region already renders « playing » — the Spectre
  // tab polls and the transport is committed to start.
  const isPlaying = transport.isPlaying || countingIn
  const { durationSeconds } = transport
  const { position } = player
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

  /**
   * « Boucler la section » : arm the loupe from the marker's start to the
   * next structure marker (or the end of the track for the last section) —
   * the same section projection the chart reads (`markerSections`).
   */
  function onLoopSection(marker: Marker): void {
    const section = markerSections(markers.markers).find(
      (candidate) => candidate.startSeconds === marker.timeSeconds
    )
    if (section === undefined) {
      return
    }
    loopEditing.selectSpan(
      makeLoopRegion(
        section.startSeconds,
        Math.min(section.endSeconds, durationSeconds)
      )
    )
  }

  /**
   * Tap-to-seek on the chart (T.3): the written measure projects onto its
   * played occurrence — the pass under (or next after) the playhead — and the
   * seek lands on that downbeat. No grid = no handler: the measures stay
   * inert instead of lying.
   */
  const onSelectMeasure =
    grid === undefined || grid.length === 0
      ? undefined
      : (writtenIndex: number) => {
          const target = measureSeekTime(
            chordChart.source,
            grid,
            writtenIndex,
            position.get()
          )
          if (target !== undefined) {
            player.seekToSeconds(target)
          }
        }

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
            undetectedStems={undetectedStems}
            onDownloadStem={onDownloadStem}
            onReimport={onReimport}
          />
          <LoopControls
            region={loopRegion}
            isSaved={loopEditing.isSaved}
            loopEnabled={loopEnabled}
            onToggleLoop={player.toggleLoop}
            onSaveRegion={loopEditing.saveRegion}
            onClearRegion={loopEditing.clearRegion}
            trainer={{ ...player.speedTrainer, state: trainerState }}
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
              carry only the results and their corrections. The gating policy
              (offload vs local health, X.1/M1.1) lives in ShellAnalyserRow. */}
          {/* AK.4 — disclose the beta gate upstream, before a Detect click
              hits it. Self-resolves the app auth (null → renders nothing). */}
          <AnalysisGateNotice />
          <ShellAnalyserRow
            disabled={!isLoaded}
            canSeparate={canSeparate}
            onSeparate={onSeparate}
            onRetryTempo={tempoDetection.retry}
            structureDetection={structureDetection}
            hasStructureMarkers={markers.markers.some(
              (marker) => marker.kind === 'structure'
            )}
            hasChartSource={chordChart.source.trim().length > 0}
            chordDetection={chordDetection}
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
              onFold={tempoDetection.fold}
              onOverrideBpm={tempoDetection.setBpm}
              onOverrideMeter={tempoDetection.setMeter}
              onTap={tempoDetection.tap}
              onAlignPhase={tempoDetection.alignPhase}
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
              onSelectMeasure={onSelectMeasure}
            />
            </ShellSection>
          )}
        </Stack>
      </main>

      <div className={styles.panelSlot}>
        <AnalysisPanel
          readSpectrum={player.readSpectrum}
          playing={isPlaying}
          position={position}
          markers={markers.markers}
          onSeekMarker={player.seekToSeconds}
          onRenameMarker={markers.rename}
          onRemoveMarker={markers.remove}
          onLoopSection={onLoopSection}
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
