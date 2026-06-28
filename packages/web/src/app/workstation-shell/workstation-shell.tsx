import type { AudioFileDecoder } from '@app/core'
import { type ChangeEvent, useRef } from 'react'
import { Stack } from '../../layout/stack/stack.tsx'
import { AnalysisPanel } from '../analysis-panel/analysis-panel.tsx'
import { Header } from '../header/header.tsx'
import { TransportBar } from '../transport-bar/transport-bar.tsx'
import { useTrackImport } from '../waveform/use-track-import.ts'
import { WaveformView } from '../waveform/waveform-view.tsx'
import styles from './workstation-shell.module.css'

const DETECTED = [
  { id: 'key', label: 'Tonalité', value: 'B♭ min' },
  { id: 'tempo', label: 'Tempo', value: '96 BPM' },
  { id: 'meter', label: 'Mesure', value: '4/4' }
] as const

interface WorkstationShellProps {
  /** The decoder port, injected in tests; defaults to the real Web Audio one. */
  readonly decoder?: AudioFileDecoder
}

/**
 * Top-level smart shell: owns the single import entry point (the header button
 * drives a hidden file input) and the track-import state, and lays the regions
 * out. The waveform is the first real slice; tracks and readouts follow.
 */
export function WorkstationShell({ decoder }: WorkstationShellProps) {
  const { state, importFile } = useTrackImport(decoder)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function onFilePicked(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    if (file) {
      void importFile(file)
    }
    // Clear it so re-picking the same file fires `change` again.
    event.target.value = ''
  }

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
            <WaveformView state={state} />
            <p className={styles.placeholderLabel}>Pistes séparées</p>
            <div className={styles.tracksPlaceholder} aria-hidden="true" />
          </Stack>
        </main>

        <AnalysisPanel />
      </div>

      <TransportBar position="0:00" duration="4:32" />
    </div>
  )
}
