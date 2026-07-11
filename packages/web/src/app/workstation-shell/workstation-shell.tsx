import {
  type AudioFileDecoder,
  type ChordDetector,
  defaultKeyBindings,
  formatTimecode,
  type PlaybackEngine,
  type ProjectDeps,
  type StemPlaybackEngine,
  type StemSeparator,
  type TempoDetector,
  type TrackMetadataReader,
  type TrackSource
} from '@app/core'
import { useLingui } from '@lingui/react/macro'
import { useMemo, useRef, useState } from 'react'
import { createWebAudioStemPlayback } from '../../audio/web-audio-stem-playback.ts'
import { useServerHealth } from '../../projects/use-server-health.ts'
import { useImportFromUrl } from '../header/use-import-from-url.ts'
import { describeKeyBindings } from '../keyboard/shortcut-hints.ts'
import { useKeyboardShortcuts } from '../keyboard/use-keyboard-shortcuts.ts'
import { useChordChartSession } from '../lead-sheet/use-chord-chart-session.ts'
import { useLoopEditing } from '../loops/use-loop-editing.ts'
import { useLoops } from '../loops/use-loops.ts'
import { useMarkers } from '../markers/use-markers.ts'
import { useMixer } from '../mixer/use-mixer.ts'
import { useSeparation } from '../separation/use-separation.ts'
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
import { useProjectSession } from './use-project-session.ts'
import { useSeparateAndLoad } from './use-separate-and-load.ts'
import { useShellDrop } from './use-shell-drop.ts'
import { useStemExport } from './use-stem-export.ts'
import { useTempoDetection } from './use-tempo-detection.ts'
import { useUnloadGuard } from './use-unload-guard.ts'
import styles from './workstation-shell.module.css'

/** The visible keyboard layout, derived once — the empty-state hero shows it. */
const SHORTCUT_HINTS = describeKeyBindings(defaultKeyBindings)

interface WorkstationShellProps {
  /** Ports injected in tests; default to the real Web Audio adapters. */
  readonly decoder?: AudioFileDecoder
  readonly engine?: PlaybackEngine
  readonly stemEngine?: StemPlaybackEngine
  readonly metadataReader?: TrackMetadataReader
  readonly separator?: StemSeparator
  readonly tempoDetector?: TempoDetector
  readonly chordDetector?: ChordDetector
  readonly trackSource?: TrackSource
  readonly projectStores?: ProjectDeps
  /** Injected in tests; the health poll defaults to the real global fetch. */
  readonly healthFetch?: typeof fetch
  /** Injected in tests; defaults to the real Web Audio one-shot player. */
  readonly countInPlayer?: CountInPlayer
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
  trackSource,
  projectStores,
  healthFetch,
  countInPlayer
}: WorkstationShellProps) {
  // One stem engine shared by the mixer (gains + loading) and the transport.
  const stemPlayback = useMemo(
    () => stemEngine ?? createWebAudioStemPlayback(),
    [stemEngine]
  )
  const { t } = useLingui()
  const { toaster, notifySuccess } = useToaster()
  const separation = useSeparation(separator)
  const mixer = useMixer(stemPlayback)
  // Separation has produced stems (drives the header export + what a save
  // persists). The metronome can join the mix without a separation, so this is
  // NOT the same as "the mix is active".
  const stemsReady = separation.state.status === 'ready'
  // The multitrack engine drives the transport whenever the mixer holds any
  // stem — separation stems, or the track + metronome when un-separated.
  const stemsActive = mixer.channels.length > 0
  const {
    importState,
    loadedAudio,
    loadedBytes,
    metadata,
    transport,
    position,
    timeRatio,
    pitchSemitones,
    loopRegion,
    importFile,
    togglePlayback,
    seekToRatio,
    seekToSeconds,
    setTimeRatio,
    setPitchSemitones,
    setLoopRegion,
    loopEnabled,
    toggleLoop,
    restoreLoop,
    speedTrainer
  } = usePlayer(decoder, engine, metadataReader, stemPlayback, stemsActive)
  const markers = useMarkers()
  const tempo = useTempo(tempoDetector)
  // The chart's source (session state riding the project lifecycle) + the
  // « Détecter les accords » flow drafting into it — see the hook's doc.
  const { chart: chordChart, detection: chordDetection } = useChordChartSession(
    {
      loadedAudio,
      grid: tempo.analysis?.grid ?? [],
      detector: chordDetector
    }
  )
  const metronome = useMetronome({ mixer })
  const loops = useLoops()
  const loopEditing = useLoopEditing(loops, {
    durationSeconds: transport.durationSeconds,
    setLoopRegion,
    seekToSeconds,
    onRegionReplaced: speedTrainer.stop
  })
  const viewport = useViewport()
  const serverHealth = useServerHealth({ fetchImpl: healthFetch })
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [projectsOpen, setProjectsOpen] = useState(false)
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
    tuning: { timeRatio, pitchSemitones, zoom: viewport.zoom },
    chordChart,
    restoreChordChart: chordChart.setSource,
    markers,
    loops,
    restoreActiveLoop: (active, savedLoopId) => {
      restoreLoop(active.region, active.enabled)
      loopEditing.restore(savedLoopId)
    },
    restoreTuning: (tuning) => {
      // The player setters re-clamp, so a hand-edited manifest stays in range.
      setTimeRatio(tuning.timeRatio)
      setPitchSemitones(tuning.pitchSemitones)
      viewport.setZoom(tuning.zoom)
    },
    separation,
    mixer,
    viewport,
    tempo,
    metronome,
    setSuppressAutoDetect: tempoDetection.suppressNextAutoDetect,
    onRestoreStarted: () => setProjectsOpen(false),
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
  const i18nImportLabel = t({
    id: 'header.import-file',
    message: 'Importer un fichier audio'
  })

  // The one hidden file input, shared by the header's « Importer » and the
  // empty-state hero (a drag never touches it — it carries a File directly).
  const fileInputRef = useRef<HTMLInputElement>(null)
  const openFilePicker = () => fileInputRef.current?.click()

  // The whole native OS-file drop story (overlay, confirm, non-audio warning).
  const drop = useShellDrop({
    importPickedFile: session.importPickedFile,
    unsavedWork: session.unsavedWork,
    importStatus: importState.status
  })

  // Separate the loaded track and wire the stems (+ metronome) into the mixer.
  const separateAndLoad = useSeparateAndLoad({ separation, tempo, mixer, metronome })
  const handleSeparate = () => {
    if (loadedAudio) {
      separateAndLoad(loadedAudio)
    }
  }

  // Reload/close would silently drop unsaved work — let the browser confirm.
  useUnloadGuard(session.unsavedWork)

  // Global keyboard layout — only live once a track is loaded.
  useKeyboardShortcuts(
    {
      togglePlayback: countIn.togglePlayback,
      seekBy: (seconds) => seekToSeconds(position.get() + seconds),
      zoomIn: viewport.zoomIn,
      zoomOut: viewport.zoomOut,
      addMarker: () => markers.addAt(position.get())
    },
    { enabled: isLoaded }
  )

  // The two stem-export entry points (+ their success toasts), off the shell.
  const { exportStems: handleExportStems, downloadStem: handleDownloadStem } =
    useStemExport({
      separation,
      tempo,
      metadata,
      trackName: session.trackName,
      loadedAudio,
      durationSeconds: transport.durationSeconds,
      notifySuccess
    })

  // The main view shows the summed mix envelope once separated (see the stage's
  // `mixWaveform`); an un-separated track shows its one waveform.
  const mainViewState = importState

  return (
    <div className={styles.shell} {...drop.dropHandlers}>
      <ShellDropLayer
        fileInputRef={fileInputRef}
        onFilePicked={session.onFilePicked}
        importLabel={i18nImportLabel}
        isDraggingFile={drop.isDraggingFile}
        pendingName={drop.pendingName}
        onConfirm={drop.confirm}
        onCancel={drop.cancel}
      />
      <ShellHeader
        metadata={metadata}
        serverHealth={serverHealth}
        session={session}
        urlImport={urlImport}
        isLoaded={isLoaded}
        stemsReady={stemsReady}
        onImport={openFilePicker}
        onExportStems={handleExportStems}
        onShowShortcuts={() => setShortcutsOpen(true)}
        onShowProjects={() => {
          void session.projects.refresh()
          setProjectsOpen(true)
        }}
        exportError={separation.exportError}
        onDismissExportError={separation.dismissExportError}
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
          position={position}
        durationSeconds={transport.durationSeconds}
        markers={markers}
        viewport={viewport}
        mixer={mixer}
        loops={loops}
        loopEditing={loopEditing}
        separation={separation}
        tempo={tempo}
        onDownloadStem={handleDownloadStem}
        mainViewState={mainViewState}
        loopRegion={loopRegion}
        loopEnabled={loopEnabled}
        onToggleLoop={toggleLoop}
        speedTrainer={speedTrainer}
        onSeekSeconds={seekToSeconds}
        onSeekRatio={seekToRatio}
        onFoldTempo={tempoDetection.fold}
        onRetryTempo={tempoDetection.retry}
        onOverrideBpm={tempoDetection.setBpm}
        onTapTempo={tempoDetection.tap}
        onAlignTempoPhase={tempoDetection.alignPhase}
        onReimport={openFilePicker}
        canSeparate={isLoaded && loadedAudio !== undefined}
        serverHealth={serverHealth}
        onSeparate={handleSeparate}
        chordChartSource={chordChart.source}
        onChordChartChange={chordChart.setSource}
        chordDetection={chordDetection}
        />
      )}

      <TransportBar
        position={position}
        duration={formatTimecode(transport.durationSeconds)}
        // During the count-in the button reads « pause » — pressing it abandons
        // the count, exactly what a pause means at that instant.
        isPlaying={transport.isPlaying || countIn.countingIn}
        canPlay={isLoaded}
        onPlayPause={countIn.togglePlayback}
        onSeekToStart={() => seekToSeconds(0)}
        onSeekToEnd={() => seekToSeconds(transport.durationSeconds)}
        tempoPercent={Math.round(timeRatio * 100)}
        pitchSemitones={pitchSemitones}
        onTempoChange={(percent) => setTimeRatio(percent / 100)}
        onPitchChange={setPitchSemitones}
      />

      <ToastRegion toaster={toaster} />
    </div>
  )
}
