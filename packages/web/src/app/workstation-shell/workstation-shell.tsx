import {
  type AudioFileDecoder,
  defaultKeyBindings,
  formatTimecode,
  type LoopStore,
  makeLoopRegion,
  type PlaybackEngine,
  type StemPlaybackEngine,
  type StemSeparator,
  type TrackMetadataReader
} from '@app/core'
import { type ChangeEvent, useMemo, useRef, useState } from 'react'
import { createWebAudioStemPlayback } from '../../audio/web-audio-stem-playback.ts'
import { Stack } from '../../layout/stack/stack.tsx'
import { AnalysisPanel } from '../analysis-panel/analysis-panel.tsx'
import { Header } from '../header/header.tsx'
import { describeKeyBindings } from '../keyboard/shortcut-hints.ts'
import { ShortcutsDialog } from '../keyboard/shortcuts-dialog.tsx'
import { useKeyboardShortcuts } from '../keyboard/use-keyboard-shortcuts.ts'
import { LoopBar } from '../loops/loop-bar.tsx'
import { useLoops } from '../loops/use-loops.ts'
import { MarkerControls } from '../markers/marker-controls.tsx'
import { MarkerRail } from '../markers/marker-rail.tsx'
import { useMarkers } from '../markers/use-markers.ts'
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
import styles from './workstation-shell.module.css'

/** Help rows derived once from the shipped layout — never drift from the keys. */
const SHORTCUT_HINTS = describeKeyBindings(defaultKeyBindings)

const DETECTED = [
  { id: 'key', label: 'Tonalité', value: 'B♭ min' },
  { id: 'tempo', label: 'Tempo', value: '96 BPM' },
  { id: 'meter', label: 'Mesure', value: '4/4' }
] as const

/** A file name without its extension, the fallback header title. */
function trackTitle(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}

interface WorkstationShellProps {
  /** Ports injected in tests; default to the real Web Audio adapters. */
  readonly decoder?: AudioFileDecoder
  readonly engine?: PlaybackEngine
  readonly stemEngine?: StemPlaybackEngine
  readonly loopStore?: LoopStore
  readonly metadataReader?: TrackMetadataReader
  readonly separator?: StemSeparator
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
  loopStore,
  metadataReader,
  separator
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
    toggleLoop
  } = usePlayer(decoder, engine, metadataReader, stemPlayback, stemsReady)
  const markers = useMarkers()
  const loops = useLoops(loopStore)
  const viewport = useViewport()
  const [trackName, setTrackName] = useState<string | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  // The saved loop the active region came from, so edge edits update it in place
  // rather than spawning a duplicate. Undefined for a fresh, unsaved selection.
  const [activeLoopId, setActiveLoopId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isLoaded = importState.status === 'loaded'

  /** A fresh surface drag: a new, unsaved region detached from any saved loop. */
  function selectRegion(startRatio: number, endRatio: number): void {
    setActiveLoopId(null)
    setLoopRegion(
      makeLoopRegion(
        startRatio * transport.durationSeconds,
        endRatio * transport.durationSeconds
      )
    )
  }

  /** A handle/keyboard edge edit: adjust the region, persisting a saved loop. */
  function adjustRegion(startRatio: number, endRatio: number): void {
    const region = makeLoopRegion(
      startRatio * transport.durationSeconds,
      endRatio * transport.durationSeconds
    )
    setLoopRegion(region)
    const active = loops.library.find((loop) => loop.id === activeLoopId)
    if (active) {
      loops.update({ ...active, region })
    }
  }

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

  function onFilePicked(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    if (file) {
      // A new track gets a fresh timeline — the old markers don't belong to it,
      // the view should start fully zoomed out, and any prior stems are stale.
      markers.clear()
      viewport.reset()
      separation.reset()
      mixer.reset()
      setTrackName(trackTitle(file.name))
      void importFile(file)
    }
    // Clear it so re-picking the same file fires `change` again.
    event.target.value = ''
  }

  const positionRatio =
    transport.durationSeconds > 0
      ? transport.positionSeconds / transport.durationSeconds
      : 0

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
        onImport={() => fileInputRef.current?.click()}
        onShowShortcuts={() => setShortcutsOpen(true)}
      />
      <ShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        hints={SHORTCUT_HINTS}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className={styles.fileInput}
        aria-label="Importer un fichier audio"
        onChange={onFilePicked}
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
                onSelectRegion={selectRegion}
                onAdjustRegion={adjustRegion}
              />
              <StemLanes channels={mixer.channels} />
            </ZoomStage>
            <LoopBar
              region={loopRegion}
              isSaved={activeLoopId !== null}
              loopEnabled={loopEnabled}
              onToggleLoop={toggleLoop}
              library={loops.library}
              onSaveRegion={(name, region) =>
                setActiveLoopId(loops.save(name, region).id)
              }
              onUpdateLoop={loops.update}
              onClearRegion={() => {
                setActiveLoopId(null)
                setLoopRegion(undefined)
              }}
              onActivate={(loop) => {
                setActiveLoopId(loop.id)
                setLoopRegion(loop.region)
                seekToSeconds(loop.region.startSeconds)
              }}
              onRemove={loops.remove}
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
