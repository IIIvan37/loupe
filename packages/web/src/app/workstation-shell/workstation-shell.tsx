import {
  type AudioFileDecoder,
  type ChordDetector,
  defaultKeyBindings,
  formatTimecode,
  type PlaybackEngine,
  type ProjectTuning,
  type ProjectDeps,
  type StemPlaybackEngine,
  type StemSeparator,
  type StructureDetector,
  type TempoDetector,
  type TrackMetadataReader,
  type TrackSource
} from '@app/core'
import { useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { isTauriShell } from '../../auth/tauri-env.ts'
import { gateReasonsOf } from '../account/gate-reasons.ts'
import { useAnalysisFold } from '../analyser/use-analysis-fold.ts'
import { useImportFromUrl } from '../header/use-import-from-url.ts'
import { describeKeyBindings } from '../keyboard/shortcut-hints.ts'
import { deriveChartHeader } from '../lead-sheet/derive-chart-header.ts'
import { useLoopEditing } from '../loops/use-loop-editing.ts'
import { useLoops } from '../loops/use-loops.ts'
import { useMarkers } from '../markers/use-markers.ts'
import { type CountInPlayer, useCountIn } from '../tempo/use-count-in.ts'
import { useMetronome } from '../tempo/use-metronome.ts'
import { useTempo } from '../tempo/use-tempo.ts'
import { TransportBar } from '../transport-bar/transport-bar.tsx'
import { usePlayer } from '../waveform/use-player.ts'
import { useViewport } from '../waveform/use-viewport.ts'
import { AlertBanner } from '../ui/alert-banner.tsx'
import { ToastRegion } from '../ui/toast-region.tsx'
import { useToaster } from '../ui/use-toaster.ts'
import { EmptyState } from './empty-state.tsx'
import { ShellDialogs } from './shell-dialogs.tsx'
import { ShellDropLayer } from './shell-drop-layer.tsx'
import { ShellHeader } from './shell-header.tsx'
import { ShellMain } from './shell-main.tsx'
import { useFilePicker } from './use-file-picker.ts'
import { useModalWarmup } from './use-modal-warmup.ts'
import { useProjectSession } from './use-project-session.ts'
import { useResumeGatedAnalysis } from './use-resume-gated-analysis.ts'
import { useStemStack } from './use-stem-stack.ts'
import { useSeparateAndLoad } from './use-separate-and-load.ts'
import { useShellDrop } from './use-shell-drop.ts'
import { useShellShortcuts } from './use-shell-shortcuts.ts'
import { useStemExport } from './use-stem-export.ts'
import { useChartWithStructure } from './use-chart-with-structure.ts'
import { useTempoDetection } from './use-tempo-detection.ts'
import { useUnloadGuard } from './use-unload-guard.ts'
import styles from './workstation-shell.module.css'

/** The visible keyboard layout, derived once — the empty-state hero shows it. */
const SHORTCUT_HINTS = describeKeyBindings(defaultKeyBindings)

/** The live tuning as a manifest persists it — an untouched fine-tune stays
 * absent (⇔ 0) so old manifests remain byte-identical. */
function tuningSnapshot(
  timeRatio: number,
  pitchSemitones: number,
  zoom: number,
  fineTuneCents: number
): ProjectTuning {
  return {
    timeRatio,
    pitchSemitones,
    zoom,
    ...(fineTuneCents === 0 ? {} : { fineTuneCents })
  }
}

/** The transport footer, wired from the player (tempo/pitch/fine-tune). */
function ShellFooter({
  player,
  isLoaded,
  countIn
}: {
  readonly player: ReturnType<typeof usePlayer>
  readonly isLoaded: boolean
  readonly countIn: ReturnType<typeof useCountIn>
}) {
  const { transport, position } = player
  return (
    <TransportBar
      position={position}
      duration={formatTimecode(transport.durationSeconds)}
      // During the count-in the button reads « pause » — pressing it abandons
      // the count, exactly what a pause means at that instant.
      isPlaying={transport.isPlaying || countIn.countingIn}
      canPlay={isLoaded}
      onPlayPause={countIn.togglePlayback}
      onSeekToStart={() => player.seekToSeconds(0)}
      onSeekToEnd={() => player.seekToSeconds(transport.durationSeconds)}
      tempoPercent={Math.round(player.timeRatio * 100)}
      pitchSemitones={player.pitchSemitones}
      onTempoChange={(percent) => player.setTimeRatio(percent / 100)}
      onPitchChange={player.setPitchSemitones}
      fineTuneCents={player.fineTuneCents}
      onFineTuneChange={player.setFineTuneCents}
    />
  )
}

interface WorkstationShellProps {
  /** Ports injected in tests; default to the real Web Audio adapters. */
  readonly decoder?: AudioFileDecoder
  readonly engine?: PlaybackEngine
  readonly stemEngine?: StemPlaybackEngine
  readonly metadataReader?: TrackMetadataReader
  readonly separator?: StemSeparator
  readonly tempoDetector?: TempoDetector
  readonly chordDetector?: ChordDetector
  readonly structureDetector?: StructureDetector
  readonly trackSource?: TrackSource
  readonly projectStores?: ProjectDeps
  /** Injected in tests; defaults to the real Web Audio one-shot player. */
  readonly countInPlayer?: CountInPlayer
  /** Whether the desktop shell hosts the app; defaults to `isTauriShell()`.
   * Injected in tests to exercise the browser-vs-desktop entry-point gating. */
  readonly desktop?: boolean
}

/**
 * Top-level smart shell: owns every hook (player, markers, loops, mixer,
 * separation, project session) and the global keyboard shortcuts, then hands
 * the wired state to the view regions — ShellHeader (identity + actions +
 * import entry point), ShellDialogs (overlays), ShellMain (timeline +
 * analysis) and the transport bar.
 */
export function WorkstationShell({
  decoder,
  engine,
  stemEngine,
  metadataReader,
  separator,
  tempoDetector,
  chordDetector,
  structureDetector,
  trackSource,
  projectStores,
  countInPlayer,
  desktop = isTauriShell()
}: WorkstationShellProps) {
  const { t } = useLingui()
  const { toaster, notifySuccess } = useToaster()
  const { stemPlayback, separation, mixer, stemsReady, stemsActive } =
    useStemStack(stemEngine, separator)
  const player = usePlayer(
    decoder,
    engine,
    metadataReader,
    stemPlayback,
    stemsActive
  )
  const {
    importState,
    loadedAudio,
    loadedBytes,
    metadata,
    transport,
    position,
    timeRatio,
    pitchSemitones,
    fineTuneCents,
    loopRegion,
    importFile,
    togglePlayback,
    seekToRatio,
    seekToSeconds,
    restoreTuning,
    setLoopRegion,
    loopEnabled,
    toggleLoop,
    restoreLoop,
    speedTrainer
  } = player
  const markers = useMarkers()
  const tempo = useTempo(tempoDetector)
  const metronome = useMetronome({ mixer })
  // Separate the loaded track and wire the stems (+ metronome) into the mixer.
  const separateAndLoad = useSeparateAndLoad({ separation, tempo, mixer, metronome })
  useModalWarmup(loadedAudio) // warm the Modal container on import (no-op locally)
  // Chart session + « Détecter les accords » / « Détecter la structure » —
  // the chart↔structure pairing (S.3b) lives in its own hook.
  const { chordChart, chordDetection, structureDetection } =
    useChartWithStructure({
      loadedAudio,
      analysis: tempo.analysis,
      markers,
      separation,
      separateAndLoad,
      chordDetector,
      structureDetector
    })
  const loops = useLoops()
  const loopEditing = useLoopEditing(loops, {
    durationSeconds: transport.durationSeconds,
    setLoopRegion,
    seekToSeconds,
    onRegionReplaced: speedTrainer.stop,
    beatGrid: tempo.analysis?.grid ?? []
  })
  const viewport = useViewport()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [projectsOpen, setProjectsOpen] = useState(false)
  // Whether the Analyse zone is unfolded (Q.3) — practice mode folds it.
  const analysisFold = useAnalysisFold()
  // Auto-detect on a fresh PCM + the panel's retry + the octave fold.
  const tempoDetection = useTempoDetection({
    tempo,
    metronome,
    loadedAudio,
    separationOwnsMix: stemsReady
  })
  // The whole project ↔ session lifecycle (save/open/detach-on-import).
  const session = useProjectSession({
    stores: projectStores,
    importFile,
    loadedBytes,
    metadata,
    stemsReady,
    loopRegion,
    loopEnabled,
    tuning: tuningSnapshot(timeRatio, pitchSemitones, viewport.zoom, fineTuneCents),
    chordChart,
    restoreChordChart: chordChart.restore,
    markers,
    loops,
    restoreActiveLoop: (active, savedLoopId) => {
      restoreLoop(active.region, active.enabled)
      loopEditing.restore(savedLoopId)
    },
    restoreTuning: (tuning) => {
      restoreTuning(tuning)
      viewport.setZoom(tuning.zoom)
    },
    separation,
    mixer,
    viewport,
    tempo,
    metronome,
    setSuppressAutoDetect: tempoDetection.suppressNextAutoDetect,
    onRestoreStarted: () => setProjectsOpen(false),
    // Practice mode: a reopened, already-analysed project folds the zone.
    onRestored: analysisFold.seatForRestoredProject,
    onFreshImport: analysisFold.seatForFreshImport,
    onSaved: (name) =>
      notifySuccess(
        t({ id: 'toast.project-saved', message: `« ${name} » enregistré` })
      )
  })

  // Importing from a URL reuses the exact file-decode path once the bytes land.
  const urlImport = useImportFromUrl(session.importDownloaded, trackSource)

  // Every start goes through the count-in: one bar of clicks first when the
  // click lane is audible, a plain start otherwise. Pause stays immediate.
  const countIn = useCountIn({
    canPlay: importState.status === 'loaded',
    isPlaying: transport.isPlaying,
    getPositionSeconds: position.get,
    timeRatio,
    analysis: tempo.analysis,
    metronomeEnabled: metronome.enabled,
    mixerState: mixer.state,
    togglePlayback,
    seekToSeconds,
    player: countInPlayer
  })

  const isLoaded = importState.status === 'loaded'
  const { fileInputRef, openFilePicker, importLabel } = useFilePicker()

  // The whole native OS-file drop story (overlay, confirm, non-audio warning).
  const drop = useShellDrop({
    importPickedFile: session.importPickedFile,
    unsavedWork: session.unsavedWork,
    importStatus: importState.status
  })

  // Reload/close would silently drop unsaved work — let the browser confirm.
  useUnloadGuard(session.unsavedWork)

  // Global command surfaces (keyboard + native menu) — only live once loaded.
  useShellShortcuts({
    enabled: isLoaded,
    openImport: openFilePicker,
    openShortcuts: () => setShortcutsOpen(true),
    countIn,
    position,
    seekToSeconds,
    grid: tempo.analysis?.grid ?? [],
    viewport,
    markers,
    toggleLoop,
    metronome,
    tempoDetection,
    session
  })

  // The two stem-export entry points (+ their success toasts), off the shell.
  const stemExport = useStemExport({
    separation,
    tempo,
    metadata,
    trackName: session.trackName,
    loadedAudio,
    durationSeconds: transport.durationSeconds,
    notifySuccess
  })

  // Replay a gate-blocked analysis once the user signs in from the menu (AK.1).
  const resumeGatedAnalysis = useResumeGatedAnalysis({
    structureDetection,
    chordDetection,
    tempo,
    tempoDetection,
    separation,
    separateAndLoad,
    loadedAudio
  })

  return (
    <div className={styles.shell} {...drop.dropHandlers}>
      <ShellDropLayer
        fileInputRef={fileInputRef}
        onFilePicked={session.onFilePicked}
        importLabel={importLabel}
        isDraggingFile={drop.isDraggingFile}
        pendingName={drop.pendingName}
        onConfirm={drop.confirm}
        onCancel={drop.cancel}
      />
      <ShellHeader
        metadata={metadata}
        session={session}
        desktop={desktop}
        urlImport={urlImport}
        isLoaded={isLoaded}
        stemsReady={stemsReady}
        onImport={openFilePicker}
        onExportStems={stemExport.exportStems}
        exportingStems={stemExport.exporting}
        onShowShortcuts={() => setShortcutsOpen(true)}
        onShowProjects={() => {
          void session.projects.refresh()
          setProjectsOpen(true)
        }}
        exportError={separation.exportError}
        onDismissExportError={separation.dismissExportError}
        gateReasons={gateReasonsOf(
          structureDetection,
          tempo,
          chordDetection,
          separation
        )}
        onResumeAfterSignIn={resumeGatedAnalysis}
      />
      <ShellDialogs
        shortcutsOpen={shortcutsOpen}
        onShortcutsOpenChange={setShortcutsOpen}
        projectsOpen={projectsOpen}
        onProjectsOpenChange={setProjectsOpen}
        session={session}
      />
      {drop.dropRejected && (
        <AlertBanner
          message={t({
            id: 'drop.unsupported',
            message: 'Format non supporté — déposer un fichier audio.'
          })}
          onDismiss={drop.dismissRejected}
        />
      )}

      {importState.status === 'idle' ? (
        <EmptyState onImport={openFilePicker} shortcuts={SHORTCUT_HINTS} />
      ) : (
        <ShellMain
          isLoaded={isLoaded}
          isPlaying={transport.isPlaying || countIn.countingIn}
          readSpectrum={player.readSpectrum}
          analysisFold={analysisFold}
          position={position}
        durationSeconds={transport.durationSeconds}
        markers={markers}
        viewport={viewport}
        mixer={mixer}
        loops={loops}
        loopEditing={loopEditing}
        separation={separation}
        tempo={tempo}
        onDownloadStem={stemExport.downloadStem}
        mainViewState={importState}
        loopRegion={loopRegion}
        loopEnabled={loopEnabled}
        onToggleLoop={toggleLoop}
        speedTrainer={speedTrainer}
        onSeekSeconds={seekToSeconds}
        onSeekRatio={seekToRatio}
        onFoldTempo={tempoDetection.fold}
        onRetryTempo={tempoDetection.retry}
        onOverrideBpm={tempoDetection.setBpm}
        onOverrideMeter={tempoDetection.setMeter}
        onTapTempo={tempoDetection.tap}
        onAlignTempoPhase={tempoDetection.alignPhase}
        onReimport={openFilePicker}
        canSeparate={isLoaded && loadedAudio !== undefined}
        onSeparate={() => separateAndLoad(loadedAudio)}
        chordChart={chordChart}
        pitchSemitones={pitchSemitones}
        chartHeader={deriveChartHeader(metadata, session.trackName, tempo.analysis)}
        chordDetection={chordDetection}
        structureDetection={structureDetection}
        />
      )}

      <ShellFooter player={player} isLoaded={isLoaded} countIn={countIn} />

      <ToastRegion toaster={toaster} />
    </div>
  )
}
