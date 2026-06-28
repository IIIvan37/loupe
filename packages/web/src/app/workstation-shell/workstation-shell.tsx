import { Stack } from '../../layout/stack/stack.tsx'
import { AnalysisPanel } from '../analysis-panel/analysis-panel.tsx'
import { Header } from '../header/header.tsx'
import { TransportBar } from '../transport-bar/transport-bar.tsx'
import styles from './workstation-shell.module.css'

const DETECTED = [
  { id: 'key', label: 'Tonalité', value: 'B♭ min' },
  { id: 'tempo', label: 'Tempo', value: '96 BPM' },
  { id: 'meter', label: 'Mesure', value: '4/4' }
] as const

/**
 * Top-level dumb layout shell for the Loupe workstation. Slice 0 wires the
 * regions and design tokens; the waveform, track list and real readouts are
 * filled in by the following slices.
 */
export function WorkstationShell() {
  return (
    <div className={styles.shell}>
      <Header title="Midnight in Amber" artist="Lena Vasquez Trio" detected={DETECTED} />

      <div className={styles.body}>
        <main className={styles.main}>
          <Stack gap="var(--space-m)">
            <p className={styles.placeholderLabel}>Forme d'onde</p>
            <div className={styles.waveformPlaceholder} aria-hidden="true" />
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
