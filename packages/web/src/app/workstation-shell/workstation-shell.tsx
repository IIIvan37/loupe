import {
  type AudioFileDecoder,
  defaultKeyBindings,
  formatTimecode,
  type LoopStore,
  makeLoopRegion,
  type PlaybackEngine,
  type TrackMetadataReader
} from '@app/core'
import { type ChangeEvent, useRef, useState } from 'react'
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
  readonly loopStore?: LoopStore
  readonly metadataReader?: TrackMetadataReader
}

/**
 * Top-level smart shell: owns the single import entry point (the header button
 * drives a hidden file input), the transport, and the global keyboard shortcuts,
 * and lays the regions out.
 */
export function WorkstationShell({
  decoder,
  engine,
  loopStore,
  metadataReader
}: WorkstationShellProps) {
  const {
    importState,
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
    setLoopRegion
  } = usePlayer(decoder, engine, metadataReader)
  const markers = useMarkers()
  const loops = useLoops(loopStore)
  const viewport = useViewport()
  const [trackName, setTrackName] = useState<string | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isLoaded = importState.status === 'loaded'

  // Global keyboard layout — only live once a track is loaded.
  useKeyboardShortcuts(
    {
      togglePlayback,
      seekBy: (seconds) => seekToSeconds(transport.positionSeconds + seconds),
      zoomIn: viewport.zoomIn,
      zoomOut: viewport.zoomOut,
      addMarker: (kind) => markers.addAt(kind, transport.positionSeconds)
    },
    { enabled: isLoaded }
  )

  function onFilePicked(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    if (file) {
      // A new track gets a fresh timeline — the old markers don't belong to it,
      // and the view should start fully zoomed out.
      markers.clear()
      viewport.reset()
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
              onAdd={(kind) => markers.addAt(kind, transport.positionSeconds)}
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
                state={importState}
                loopRegion={loopRegion}
                durationSeconds={transport.durationSeconds}
                onSeek={seekToRatio}
                onSelectRegion={(start, end) =>
                  setLoopRegion(
                    makeLoopRegion(
                      start * transport.durationSeconds,
                      end * transport.durationSeconds
                    )
                  )
                }
              />
            </ZoomStage>
            <LoopBar
              hasRegion={loopRegion !== undefined}
              library={loops.library}
              onSaveRegion={() => {
                if (!loopRegion) {
                  return
                }
                const name = window.prompt('Nom de la boucle')?.trim()
                if (name) {
                  loops.save(name, loopRegion)
                }
              }}
              onClearRegion={() => setLoopRegion(undefined)}
              onActivate={(loop) => {
                setLoopRegion(loop.region)
                seekToSeconds(loop.region.startSeconds)
              }}
              onRemove={loops.remove}
            />
            <p className={styles.placeholderLabel}>Pistes séparées</p>
            <div className={styles.tracksPlaceholder} aria-hidden="true" />
          </Stack>
        </main>

        <AnalysisPanel
          markers={markers.markers}
          onSeekMarker={seekToSeconds}
          onRemoveMarker={markers.remove}
        />
      </div>

      <TransportBar
        position={formatTimecode(transport.positionSeconds)}
        duration={formatTimecode(transport.durationSeconds)}
        isPlaying={transport.isPlaying}
        canPlay={isLoaded}
        onPlayPause={togglePlayback}
        tempoPercent={Math.round(timeRatio * 100)}
        pitchSemitones={pitchSemitones}
        onTempoChange={(percent) => setTimeRatio(percent / 100)}
        onPitchChange={setPitchSemitones}
      />
    </div>
  )
}
