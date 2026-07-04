import {
  type AudioFileDecoder,
  encodeWav,
  formatTimecode,
  type MixerState,
  type PlaybackEngine,
  type ProjectDeps,
  type StemPlaybackEngine,
  type StemSeparator,
  synthesizeClickTrack,
  type TempoDetector,
  type TrackMetadataReader,
  UNITY_GAIN_DB
} from '@app/core'
import {
  DEFAULT_METRONOME_CHANNEL,
  METRONOME_ID
} from '../tempo/metronome-stem.ts'
import { TRACK_STEM_ID } from '../mixer/track-stem.ts'
import { useEffect, useMemo, useRef, useState } from 'react'
import { downloadBlob } from '../../audio/download-blob.ts'
import { createWebAudioStemPlayback } from '../../audio/web-audio-stem-playback.ts'
import { exportBaseName } from '../../lib/export-base-name.ts'
import { useServerHealth } from '../../projects/use-server-health.ts'
import { useKeyboardShortcuts } from '../keyboard/use-keyboard-shortcuts.ts'
import { useLoopEditing } from '../loops/use-loop-editing.ts'
import { useLoops } from '../loops/use-loops.ts'
import { useMarkers } from '../markers/use-markers.ts'
import { useMixer } from '../mixer/use-mixer.ts'
import { useSeparation } from '../separation/use-separation.ts'
import { useMetronome } from '../tempo/use-metronome.ts'
import { useTempo } from '../tempo/use-tempo.ts'
import { TransportBar } from '../transport-bar/transport-bar.tsx'
import { usePlayer } from '../waveform/use-player.ts'
import { useViewport } from '../waveform/use-viewport.ts'
import { ShellDialogs } from './shell-dialogs.tsx'
import { ShellHeader } from './shell-header.tsx'
import { ShellMain } from './shell-main.tsx'
import { useProjectSession } from './use-project-session.ts'
import { useUnloadGuard } from './use-unload-guard.ts'
import styles from './workstation-shell.module.css'

interface WorkstationShellProps {
  /** Ports injected in tests; default to the real Web Audio adapters. */
  readonly decoder?: AudioFileDecoder
  readonly engine?: PlaybackEngine
  readonly stemEngine?: StemPlaybackEngine
  readonly metadataReader?: TrackMetadataReader
  readonly separator?: StemSeparator
  readonly tempoDetector?: TempoDetector
  readonly projectStores?: ProjectDeps
  /** Injected in tests; the health poll defaults to the real global fetch. */
  readonly healthFetch?: typeof fetch
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
  } = usePlayer(decoder, engine, metadataReader, stemPlayback, stemsActive)
  const markers = useMarkers()
  const tempo = useTempo(tempoDetector)
  const metronome = useMetronome({ mixer })
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
  // One-shot guard: an open arms it before re-importing its bytes so the
  // auto-detect effect below skips that audio (the open seats tempo itself).
  const suppressAutoDetectRef = useRef(false)
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
    setSuppressAutoDetect: (suppress) => {
      suppressAutoDetectRef.current = suppress
    },
    onRestoreStarted: () => setProjectsOpen(false)
  })

  const isLoaded = importState.status === 'loaded'

  // Auto-detect the tempo the moment a track's PCM lands (import or project
  // open) and seat the always-on metronome from the result — no button. Held in
  // a ref so the effect keys on `loadedAudio` alone yet always calls the live
  // detect/enable (both read fresh state internally).
  const autoDetectRef = useRef<(audio: typeof loadedAudio) => void>(() => {})
  autoDetectRef.current = (audio) => {
    if (!audio) {
      return
    }
    // An open owns tempo/metronome seating for its restored audio — skip it here.
    if (suppressAutoDetectRef.current) {
      suppressAutoDetectRef.current = false
      return
    }
    void tempo.detect(audio).then((analysis) => {
      if (analysis) {
        // A freshly detected click joins the un-separated track muted by default.
        metronome.enable(analysis.grid, audio, DEFAULT_METRONOME_CHANNEL)
      }
    })
  }
  useEffect(() => {
    autoDetectRef.current(loadedAudio)
  }, [loadedAudio])

  // Reload/close would silently drop unsaved work — let the browser confirm.
  useUnloadGuard(session.unsavedWork)

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
    void separation.exportStems(exportBaseName(metadata.title, session.trackName))
  }

  // Download one mixer lane as a WAV. The synthetic lanes (the click, and the
  // whole track when un-separated) are rendered on the fly; a separated stem
  // defers to the separation's own numbered download.
  const handleDownloadStem = (id: string) => {
    const base = exportBaseName(metadata.title, session.trackName)
    if (id === METRONOME_ID && tempo.analysis && loadedAudio) {
      const samples = synthesizeClickTrack({
        beats: tempo.analysis.grid,
        durationSeconds: transport.durationSeconds,
        sampleRate: loadedAudio.sampleRate
      })
      const wav = encodeWav([samples], loadedAudio.sampleRate)
      downloadBlob(`${base}_metronome.wav`, new Blob([wav], { type: 'audio/wav' }))
      return
    }
    if (id === TRACK_STEM_ID && loadedAudio) {
      const wav = encodeWav(loadedAudio.channels, loadedAudio.sampleRate)
      downloadBlob(`${base}_piste.wav`, new Blob([wav], { type: 'audio/wav' }))
      return
    }
    separation.downloadStem(id)
  }

  // While any stem drives the mix, each stem is drawn into the main view in its
  // own colour (see `mixLayers`); an un-separated track shows its one waveform.
  const mainViewState = importState

  return (
    <div className={styles.shell}>
      <ShellHeader
        metadata={metadata}
        serverHealth={serverHealth}
        session={session}
        isLoaded={isLoaded}
        stemsReady={stemsReady}
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

      <ShellMain
        isLoaded={isLoaded}
        positionRatio={positionRatio}
        positionSeconds={transport.positionSeconds}
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
        onSeekSeconds={seekToSeconds}
        onSeekRatio={seekToRatio}
        canSeparate={isLoaded && loadedAudio !== undefined}
        onSeparate={() => {
          if (loadedAudio) {
            // Wire the mixer right where the stems are produced — no effect
            // watching props (the audio engine sync belongs to this event).
            void separation.separate(loadedAudio).then((result) => {
              if (!result) {
                return
              }
              // Load the stems (and, if the tempo is known, the always-on click
              // alongside them) in one pass, so neither overwrites the other.
              if (tempo.analysis && loadedAudio) {
                // Fresh stems start at unity; carry the metronome's current
                // settings (muted by default, or whatever the user set). Only
                // PRESENT stems get a channel — same as `mixer.load`, so the
                // masked ones never become phantom channels the save persists.
                const baseMixer: MixerState = result.stems.flatMap((stem) =>
                  stem.present
                    ? [{ id: stem.id, gainDb: UNITY_GAIN_DB, muted: false, soloed: false }]
                    : []
                )
                const metronomeChannel =
                  mixer.state.find((channel) => channel.id === METRONOME_ID) ??
                  DEFAULT_METRONOME_CHANNEL
                metronome.attach(
                  tempo.analysis.grid,
                  result.stems,
                  result.sources,
                  loadedAudio,
                  baseMixer,
                  metronomeChannel
                )
              } else {
                mixer.load(result.stems, result.sources)
              }
            })
          }
        }}
      />

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
