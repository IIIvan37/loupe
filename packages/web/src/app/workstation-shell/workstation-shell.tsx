import { type AudioFileDecoder, formatTimecode, type PlaybackEngine } from '@app/core'
import { type ChangeEvent, useEffect, useRef } from 'react'
import { Stack } from '../../layout/stack/stack.tsx'
import { AnalysisPanel } from '../analysis-panel/analysis-panel.tsx'
import { Header } from '../header/header.tsx'
import { TransportBar } from '../transport-bar/transport-bar.tsx'
import { usePlayer } from '../waveform/use-player.ts'
import { WaveformView } from '../waveform/waveform-view.tsx'
import styles from './workstation-shell.module.css'

const DETECTED = [
  { id: 'key', label: 'Tonalité', value: 'B♭ min' },
  { id: 'tempo', label: 'Tempo', value: '96 BPM' },
  { id: 'meter', label: 'Mesure', value: '4/4' }
] as const

const INTERACTIVE_TAGS = ['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT']

interface WorkstationShellProps {
  /** Ports injected in tests; default to the real Web Audio adapters. */
  readonly decoder?: AudioFileDecoder
  readonly engine?: PlaybackEngine
}

/**
 * Top-level smart shell: owns the single import entry point (the header button
 * drives a hidden file input), the transport, and the global Space shortcut, and
 * lays the regions out.
 */
export function WorkstationShell({ decoder, engine }: WorkstationShellProps) {
  const {
    importState,
    transport,
    timeRatio,
    pitchSemitones,
    importFile,
    togglePlayback,
    seekToRatio,
    setTimeRatio,
    setPitchSemitones
  } = usePlayer(decoder, engine)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Keep a stable Space listener pointed at the latest toggle (updated after
  // each commit, so the listener never closes over a stale transport).
  const toggleRef = useRef(togglePlayback)
  useEffect(() => {
    toggleRef.current = togglePlayback
  })
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.code !== 'Space') {
        return
      }
      const target = event.target
      if (target instanceof HTMLElement && INTERACTIVE_TAGS.includes(target.tagName)) {
        return
      }
      event.preventDefault()
      toggleRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function onFilePicked(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    if (file) {
      void importFile(file)
    }
    // Clear it so re-picking the same file fires `change` again.
    event.target.value = ''
  }

  const isLoaded = importState.status === 'loaded'
  const positionRatio =
    transport.durationSeconds > 0
      ? transport.positionSeconds / transport.durationSeconds
      : 0

  return (
    <div className={styles.shell}>
      <Header
        title="Midnight in Amber"
        artist="Lena Vasquez Trio"
        detected={DETECTED}
        onImport={() => fileInputRef.current?.click()}
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
            <p className={styles.placeholderLabel}>Forme d'onde</p>
            <WaveformView
              state={importState}
              positionRatio={positionRatio}
              onSeek={seekToRatio}
            />
            <p className={styles.placeholderLabel}>Pistes séparées</p>
            <div className={styles.tracksPlaceholder} aria-hidden="true" />
          </Stack>
        </main>

        <AnalysisPanel />
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
