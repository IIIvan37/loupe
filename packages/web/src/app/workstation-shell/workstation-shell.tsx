import { formatTimecode, type ProjectTuning } from '@app/core'
import { useLingui } from '@lingui/react/macro'
import { useSetAtom } from 'jotai'
import { useState } from 'react'
import type { ExternalValue } from '../../lib/external-value.ts'
import { isServerShell } from '../../lib/server-shell.ts'
import { gateReasonsOf } from '../account/gate-reasons.ts'
import { useAnalysisFold } from '../analyser/use-analysis-fold.ts'
import { AudioSessionWithPlayer } from '../audio-session/audio-session-provider.tsx'
import { useImportFromUrl } from '../header/use-import-from-url.ts'
import { deriveChartHeader } from '../lead-sheet/derive-chart-header.ts'
import { activeLoopIdAtom } from '../loops/loop-atoms.ts'
import { UnloadGuard } from './lifecycle/use-unload-guard.ts'
import { useLoops } from '../loops/use-loops.ts'
import { useMarkers } from '../markers/use-markers.ts'
import { useCountIn } from '../tempo/use-count-in.ts'
import { useMetronome } from '../tempo/use-metronome.ts'
import { useTempo } from '../tempo/use-tempo.ts'
import { useTempoDetection } from '../tempo/use-tempo-detection.ts'
import { TransportBar } from '../transport-bar/transport-bar.tsx'
import { usePlayer } from '../waveform/use-player.ts'
import { useViewport } from '../waveform/use-viewport.ts'
import { AlertBanner } from '../ui/alert-banner/alert-banner.tsx'
import { ToastRegion } from '../ui/toast-region/toast-region.tsx'
import { useToaster } from '../ui/use-toaster.ts'
import { EmptyState } from './regions/empty-state/empty-state.tsx'
import { ShellDialogs } from './regions/shell-dialogs.tsx'
import { takeChargeBusy } from './regions/shell-busy.ts'
import { ShellDropLayer } from './regions/shell-drop-layer/shell-drop-layer.tsx'
import { ShellHeader } from './regions/shell-header.tsx'
import { ShellMain } from './regions/shell-main/shell-main.tsx'
import { useFilePicker } from './lifecycle/use-file-picker.ts'
import { useModalWarmup } from './lifecycle/use-modal-warmup.ts'
import { useProjectSession } from './orchestration/use-project-session.ts'
import { useResumeGatedAnalysis } from './orchestration/use-resume-gated-analysis.ts'
import { useStemStack } from './orchestration/use-stem-stack.ts'
import { useSeparateAndLoad } from './orchestration/use-separate-and-load.ts'
import { useShellDrop } from './lifecycle/use-shell-drop.ts'
import { useShellShortcuts } from './orchestration/use-shell-shortcuts.ts'
import { useStemExport } from './orchestration/use-stem-export.ts'
import { useChartWithStructure } from './orchestration/use-chart-with-structure.ts'
import styles from './workstation-shell.module.css'

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

/** The transport footer, wired from the values it reads — never a hook bag
 * (ADR 0010): formatting and unit conversion live here, state upstairs. */
function ShellFooter({
  position,
  durationSeconds,
  isPlaying,
  canPlay,
  onPlayPause,
  seekToSeconds,
  timeRatio,
  setTimeRatio,
  pitchSemitones,
  setPitchSemitones,
  fineTuneCents,
  setFineTuneCents
}: {
  readonly position: ExternalValue<number>
  readonly durationSeconds: number
  readonly isPlaying: boolean
  readonly canPlay: boolean
  readonly onPlayPause: () => void
  readonly seekToSeconds: (seconds: number) => void
  readonly timeRatio: number
  readonly setTimeRatio: (ratio: number) => void
  readonly pitchSemitones: number
  readonly setPitchSemitones: (semitones: number) => void
  readonly fineTuneCents: number
  readonly setFineTuneCents: (cents: number) => void
}) {
  return (
    <TransportBar
      position={position}
      duration={formatTimecode(durationSeconds)}
      isPlaying={isPlaying}
      canPlay={canPlay}
      onPlayPause={onPlayPause}
      onSeekToStart={() => seekToSeconds(0)}
      onSeekToEnd={() => seekToSeconds(durationSeconds)}
      tempoPercent={Math.round(timeRatio * 100)}
      pitchSemitones={pitchSemitones}
      onTempoChange={(percent) => setTimeRatio(percent / 100)}
      onPitchChange={setPitchSemitones}
      fineTuneCents={fineTuneCents}
      onFineTuneChange={setFineTuneCents}
    />
  )
}

/**
 * The speed/pitch slices the `[`/`]` and `{`/`}` shortcuts read and drive:
 * the whole-percent tempo and the semitone pitch, each with its setter. Kept
 * off the component so the shell body stays under the react-doctor budget.
 */
function playbackSteppers(player: ReturnType<typeof usePlayer>): {
  readonly speed: { readonly percent: number; readonly setPercent: (percent: number) => void }
  readonly pitch: { readonly semitones: number; readonly setSemitones: (semitones: number) => void }
} {
  return {
    speed: {
      percent: Math.round(player.timeRatio * 100),
      setPercent: (percent) => player.setTimeRatio(percent / 100)
    },
    pitch: {
      semitones: player.pitchSemitones,
      setSemitones: player.setPitchSemitones
    }
  }
}

interface WorkstationShellProps {
  /** Whether the local loupe server hosts the app (D1) — gates Save /
   * Projects / URL import. Injected in tests to exercise the plain-browser
   * entry-point gating. */
  readonly localBackend?: boolean
}

/**
 * Top-level smart shell: owns every hook (player, markers, loops, mixer,
 * separation, project session) and the global keyboard shortcuts, then hands
 * the wired state to the view regions — ShellHeader (identity + actions +
 * import entry point), ShellDialogs (overlays), ShellMain (timeline +
 * analysis) and the transport bar. The ports are not its business anymore:
 * each consumer hook reaches them through the audio session (ADR 0011).
 */
export function WorkstationShell({
  localBackend = isServerShell()
}: WorkstationShellProps) {
  const { t } = useLingui()
  const { toaster, notifySuccess } = useToaster()
  const { stemPlayback, separation, mixer, stemsReady } = useStemStack()
  // The stem engine is a SINGLETON shared with the mixer/separation stack —
  // hand the stack's instance over, never let the player make its own.
  const player = usePlayer(undefined, undefined, undefined, stemPlayback)
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
    seekToSeconds,
    restoreTuning,
    loopEnabled,
    toggleLoop,
    restoreLoop
  } = player
  const markers = useMarkers()
  const tempo = useTempo()
  const metronome = useMetronome({ mixer })
  // Separate the loaded track and wire the stems (+ metronome) into the mixer.
  // Separation and metronome are the features' own (ADR 0010) — seam only.
  const separateAndLoad = useSeparateAndLoad({ mixer })
  useModalWarmup(loadedAudio) // warm the Modal container on import (no-op locally)
  // Chart session + « Détecter les accords » / « Détecter la structure » —
  // the chart↔structure pairing (S.3b) lives in its own hook.
  const { chordChart, chordDetection, structureDetection } =
    useChartWithStructure({
      loadedAudio,
      analysis: tempo.analysis,
      markers,
      separation,
      separateAndLoad
    })
  const loops = useLoops()
  // Relinking a restored region to its saved loop is a plain seat of the
  // loops feature's atom — the editing bridge itself lives in the regions
  // (ADR 0010), the shell only wires the project open.
  const restoreActiveLoopId = useSetAtom(activeLoopIdAtom)
  const viewport = useViewport()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [projectsOpen, setProjectsOpen] = useState(false)
  // Whether the Analyse zone is unfolded (Q.3) — practice mode folds it.
  const analysisFold = useAnalysisFold()
  // Auto-detect on a fresh PCM + the panel's retry + the octave fold. Tempo
  // and metronome are the feature's own (ADR 0010) — only the mixer seam and
  // values go in.
  const tempoDetection = useTempoDetection({
    mixer,
    loadedAudio,
    separationOwnsMix: stemsReady
  })
  // The whole project ↔ session lifecycle (save/open/detach-on-import).
  const session = useProjectSession({
    importFile,
    loadedBytes,
    metadata,
    stemsReady,
    loopRegion,
    loopEnabled,
    tuning: tuningSnapshot(timeRatio, pitchSemitones, viewport.zoom, fineTuneCents),
    markers,
    loops,
    restoreActiveLoop: (active, savedLoopId) => {
      restoreLoop(active.region, active.enabled)
      restoreActiveLoopId(savedLoopId)
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
  const urlImport = useImportFromUrl(session.importDownloaded)

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
    seekToSeconds
  })

  const isLoaded = importState.status === 'loaded'
  const { fileInputRef, openFilePicker, importLabel } = useFilePicker()

  // The whole native OS-file drop story (overlay, confirm, non-audio warning).
  const drop = useShellDrop({
    importPickedFile: session.importPickedFile,
    unsavedWork: session.unsavedWork,
    importStatus: importState.status
  })

  // Global command surfaces (keyboard + native menu) — only live once loaded.
  useShellShortcuts({
    enabled: isLoaded,
    countIn,
    position,
    seekToSeconds,
    grid: tempo.analysis?.grid ?? [],
    viewport,
    ...playbackSteppers(player),
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
    separateAndLoad,
    loadedAudio,
    mixer,
    separationOwnsMix: stemsReady
  })

  return (
    <AudioSessionWithPlayer player={player.handle} stemEngine={stemPlayback}>
    <div className={styles.shell} {...drop.dropHandlers}>
      <ShellDropLayer
        fileInputRef={fileInputRef}
        onFilePicked={session.onFilePicked}
        importLabel={importLabel}
        isDraggingFile={drop.isDraggingFile}
        busy={takeChargeBusy(session, urlImport, importState.status)}
        pendingName={drop.pendingName}
        onConfirm={drop.confirm}
        onCancel={drop.cancel}
      />
      {/* Leaving must never silently drop unsaved work — the browser's
          native beforeunload prompt (reload, tab close). */}
      <UnloadGuard unsavedWork={session.unsavedWork} />
      <ShellHeader
        metadata={metadata}
        session={session}
        localBackend={localBackend}
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
        <EmptyState
          onImport={openFilePicker}
          onImportUrl={localBackend ? urlImport.submit : undefined}
          urlBusy={urlImport.running}
        />
      ) : (
        <ShellMain
          analysisFold={analysisFold}
          onDownloadStem={stemExport.downloadStem}
          tempoDetection={tempoDetection}
          onReimport={openFilePicker}
          canSeparate={isLoaded && loadedAudio !== undefined}
          onSeparate={() => separateAndLoad(loadedAudio)}
          chordChart={chordChart}
          chartHeader={deriveChartHeader(metadata, session.trackName, tempo.analysis)}
          chordDetection={chordDetection}
          structureDetection={structureDetection}
        />
      )}

      <ShellFooter
        position={position}
        durationSeconds={transport.durationSeconds}
        // During the count-in the button reads « pause » — pressing it
        // abandons the count, exactly what a pause means at that instant.
        isPlaying={transport.isPlaying || countIn.countingIn}
        canPlay={isLoaded}
        onPlayPause={countIn.togglePlayback}
        seekToSeconds={seekToSeconds}
        timeRatio={timeRatio}
        setTimeRatio={player.setTimeRatio}
        pitchSemitones={pitchSemitones}
        setPitchSemitones={player.setPitchSemitones}
        fineTuneCents={fineTuneCents}
        setFineTuneCents={player.setFineTuneCents}
      />

      <ToastRegion toaster={toaster} />
    </div>
    </AudioSessionWithPlayer>
  )
}
