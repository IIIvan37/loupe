import {
  type AudioFileDecoder,
  defaultKeyBindings,
  formatTimecode,
  type PlaybackEngine,
  type ProjectDeps,
  type StemPlaybackEngine,
  type StemSeparator,
  type TrackMetadataReader
} from '@app/core'
import { useMemo, useRef, useState } from 'react'
import { createWebAudioStemPlayback } from '../../audio/web-audio-stem-playback.ts'
import { Stack } from '../../layout/stack/stack.tsx'
import { AnalysisPanel } from '../analysis-panel/analysis-panel.tsx'
import { Header } from '../header/header.tsx'
import { describeKeyBindings } from '../keyboard/shortcut-hints.ts'
import { ShortcutsDialog } from '../keyboard/shortcuts-dialog.tsx'
import { useKeyboardShortcuts } from '../keyboard/use-keyboard-shortcuts.ts'
import { LoopBar } from '../loops/loop-bar.tsx'
import { useLoopEditing } from '../loops/use-loop-editing.ts'
import { useLoops } from '../loops/use-loops.ts'
import { MarkerControls } from '../markers/marker-controls.tsx'
import { MarkerRail } from '../markers/marker-rail.tsx'
import { useMarkers } from '../markers/use-markers.ts'
import { ProjectsDialog } from '../../projects/projects-dialog.tsx'
import {
  type ServerHealth,
  useServerHealth
} from '../../projects/use-server-health.ts'
import { exportBaseName } from '../../lib/export-base-name.ts'
import { AlertBanner } from '../ui/alert-banner.tsx'
import { MixerPanel } from '../mixer/mixer-panel.tsx'
import { StemLanes } from '../mixer/stem-lanes.tsx'
import { useMixer } from '../mixer/use-mixer.ts'
import { SeparationPanel } from '../separation/separation-panel.tsx'
import { useSeparation } from '../separation/use-separation.ts'
import { TransportBar } from '../transport-bar/transport-bar.tsx'
import { usePlayer } from '../waveform/use-player.ts'
import { useViewport } from '../waveform/use-viewport.ts'
import { WaveformView } from '../waveform/waveform-view.tsx'
import { ZoomStage } from '../waveform/zoom-stage.tsx'
import { useProjectSession } from './use-project-session.ts'
import styles from './workstation-shell.module.css'

/** Help rows derived once from the shipped layout — never drift from the keys. */
const SHORTCUT_HINTS = describeKeyBindings(defaultKeyBindings)

/**
 * No real key/tempo detection yet — show nothing rather than a hardcoded lie.
 * The header keeps its `detected` prop for when detection lands.
 */
const DETECTED: readonly never[] = []

/** How each probed health state reads in the header. */
const SERVER_STATUS: Record<
  Exclude<ServerHealth, 'checking'>,
  { readonly tone: 'offline' | 'degraded' | 'ready'; readonly label: string }
> = {
  offline: { tone: 'offline', label: 'Serveur hors ligne' },
  'no-separation': { tone: 'degraded', label: 'Séparation indisponible' },
  ready: { tone: 'ready', label: 'Serveur prêt' }
}

interface WorkstationShellProps {
  /** Ports injected in tests; default to the real Web Audio adapters. */
  readonly decoder?: AudioFileDecoder
  readonly engine?: PlaybackEngine
  readonly stemEngine?: StemPlaybackEngine
  readonly metadataReader?: TrackMetadataReader
  readonly separator?: StemSeparator
  readonly projectStores?: ProjectDeps
  /** Injected in tests; the health poll defaults to the real global fetch. */
  readonly healthFetch?: typeof fetch
}

/**
 * Top-level smart shell: owns the single import entry point (the header button
 * drives a hidden file input), the transport, and the global keyboard shortcuts,
 * and lays the regions out.
 */
export function WorkstationShell({
  decoder,
  engine,
  stemEngine,
  metadataReader,
  separator,
  projectStores,
  healthFetch
}: WorkstationShellProps) {
  // One stem engine shared by the mixer (gains + loading) and the transport.
  const stemPlayback = useMemo(
    () => stemEngine ?? createWebAudioStemPlayback(),
    [stemEngine]
  )
  const separation = useSeparation(separator)
  const mixer = useMixer(stemPlayback)
  const stemsReady =
    separation.state.status === 'ready' && mixer.channels.length > 0
  const {
    importState,
    loadedAudio,
    loadedBytes,
    metadata,
    transport,
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
    restoreLoop
  } = usePlayer(decoder, engine, metadataReader, stemPlayback, stemsReady)
  const markers = useMarkers()
  const loops = useLoops()
  const loopEditing = useLoopEditing(loops, {
    durationSeconds: transport.durationSeconds,
    setLoopRegion,
    seekToSeconds
  })
  const viewport = useViewport()
  const serverHealth = useServerHealth({ fetchImpl: healthFetch })
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [projectsOpen, setProjectsOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // The whole project ↔ session lifecycle (save/open/detach-on-import).
  const session = useProjectSession({
    stores: projectStores,
    importFile,
    loadedBytes,
    metadata,
    stemsReady,
    loopRegion,
    loopEnabled,
    markers,
    loops,
    restoreActiveLoop: (active, savedLoopId) => {
      restoreLoop(active.region, active.enabled)
      loopEditing.restore(savedLoopId)
    },
    separation,
    mixer,
    viewport,
    onRestoreStarted: () => setProjectsOpen(false)
  })
  const { projects, trackName, currentProject } = session

  const isLoaded = importState.status === 'loaded'

  // Global keyboard layout — only live once a track is loaded.
  useKeyboardShortcuts(
    {
      togglePlayback,
      seekBy: (seconds) => seekToSeconds(transport.positionSeconds + seconds),
      zoomIn: viewport.zoomIn,
      zoomOut: viewport.zoomOut,
      addMarker: () => markers.addAt(transport.positionSeconds)
    },
    { enabled: isLoaded }
  )

  const positionRatio =
    transport.durationSeconds > 0
      ? transport.positionSeconds / transport.durationSeconds
      : 0

  // One export entry point shared by the header and the mixer panel.
  const handleExportStems = () => {
    void separation.exportStems(exportBaseName(metadata.title, trackName))
  }

  // The long operations get one visible status strip (the dialog may be closed
  // while an open is still rebuilding the session).
  const openingProject = projects.projects.find(
    (p) => p.id === session.openingId
  )
  const busyMessage =
    projects.busy === 'save'
      ? 'Enregistrement du projet…'
      : openingProject !== undefined
        ? `Ouverture de « ${openingProject.name} »…`
        : undefined

  // Once the stems are mixing, the main view shows the audible mix (recomputed as
  // the faders/solo/mute change); otherwise it shows the imported track itself.
  const mainViewState =
    stemsReady && importState.status === 'loaded'
      ? {
          status: 'loaded' as const,
          track: { ...importState.track, waveform: mixer.mixWaveform }
        }
      : importState

  return (
    <div className={styles.shell}>
      <Header
        title={metadata.title ?? trackName ?? 'Aucun morceau'}
        artist={
          metadata.artist ??
          (trackName ? 'Artiste inconnu' : 'Importe un fichier audio')
        }
        detected={DETECTED}
        serverStatus={
          serverHealth === 'checking' ? undefined : SERVER_STATUS[serverHealth]
        }
        onImport={() => fileInputRef.current?.click()}
        onExportStems={handleExportStems}
        canExport={stemsReady}
        onShowShortcuts={() => setShortcutsOpen(true)}
        onSaveProject={session.handleSave}
        saveName={currentProject?.name ?? trackName ?? ''}
        canSave={isLoaded}
        hasProject={currentProject !== undefined}
        saving={projects.busy === 'save'}
        dirty={session.dirty}
        onShowProjects={() => {
          void projects.refresh()
          setProjectsOpen(true)
        }}
      />
      {projects.error !== undefined && (
        <AlertBanner
          message={projects.error}
          onDismiss={projects.dismissError}
        />
      )}
      {separation.exportError !== undefined && (
        <AlertBanner
          message={separation.exportError}
          onDismiss={separation.dismissExportError}
        />
      )}
      {busyMessage !== undefined && (
        <output className={styles.busyBanner}>{busyMessage}</output>
      )}
      <ShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        hints={SHORTCUT_HINTS}
      />
      <ProjectsDialog
        open={projectsOpen}
        onOpenChange={setProjectsOpen}
        projects={projects.projects}
        onOpen={(id) => void session.handleOpen(id)}
        onDelete={(id) => void projects.remove(id)}
        errorMessage={
          projects.listError
            ? 'Serveur injoignable — vérifie que le serveur local est lancé'
            : undefined
        }
        openingId={session.openingId}
        confirmBeforeOpen={isLoaded}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className={styles.fileInput}
        aria-label="Importer un fichier audio"
        onChange={session.onFilePicked}
      />

      <div className={styles.body}>
        <main className={styles.main}>
          <Stack gap="var(--space-m)">
            <MarkerControls
              disabled={!isLoaded}
              onAdd={() => markers.addAt(transport.positionSeconds)}
            />
            <ZoomStage
              zoom={viewport.zoom}
              positionRatio={positionRatio}
              disabled={!isLoaded}
              onZoomIn={viewport.zoomIn}
              onZoomOut={viewport.zoomOut}
              onSetZoom={viewport.setZoom}
            >
              <MarkerRail
                markers={markers.markers}
                durationSeconds={transport.durationSeconds}
                onSeek={seekToSeconds}
              />
              <WaveformView
                state={mainViewState}
                loopRegion={loopRegion}
                loopEnabled={loopEnabled}
                durationSeconds={transport.durationSeconds}
                onSeek={seekToRatio}
                onSelectRegion={loopEditing.selectRegion}
                onAdjustRegion={loopEditing.adjustRegion}
              />
              <StemLanes channels={mixer.channels} />
            </ZoomStage>
            <LoopBar
              region={loopRegion}
              isSaved={loopEditing.isSaved}
              activeLoopId={loopEditing.activeLoopId}
              loopEnabled={loopEnabled}
              onToggleLoop={toggleLoop}
              library={loops.library}
              onSaveRegion={loopEditing.saveRegion}
              onUpdateLoop={loops.update}
              onClearRegion={loopEditing.clearRegion}
              onActivate={loopEditing.activate}
              onRemove={loopEditing.remove}
            />
            <SeparationPanel
              state={separation.state}
              canSeparate={isLoaded && loadedAudio !== undefined}
              onSeparate={() => {
                if (loadedAudio) {
                  // Wire the mixer right where the stems are produced — no effect
                  // watching props (the audio engine sync belongs to this event).
                  void separation
                    .separate(loadedAudio)
                    .then((result) => result && mixer.load(result.stems, result.sources))
                }
              }}
            />
            <MixerPanel
              channels={mixer.channels}
              onSetGain={mixer.setGain}
              onToggleMute={mixer.toggleMute}
              onToggleSolo={mixer.toggleSolo}
              onDownloadStem={separation.downloadStem}
            />
          </Stack>
        </main>

        <AnalysisPanel
          markers={markers.markers}
          onSeekMarker={seekToSeconds}
          onRenameMarker={markers.rename}
          onRemoveMarker={markers.remove}
        />
      </div>

      <TransportBar
        position={formatTimecode(transport.positionSeconds)}
        duration={formatTimecode(transport.durationSeconds)}
        isPlaying={transport.isPlaying}
        canPlay={isLoaded}
        onPlayPause={togglePlayback}
        onSeekToStart={() => seekToSeconds(0)}
        onSeekToEnd={() => seekToSeconds(transport.durationSeconds)}
        tempoPercent={Math.round(timeRatio * 100)}
        pitchSemitones={pitchSemitones}
        onTempoChange={(percent) => setTimeRatio(percent / 100)}
        onPitchChange={setPitchSemitones}
      />
    </div>
  )
}
