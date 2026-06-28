import { Stack } from '../../layout/stack/stack.tsx'
import type { TrackImportState } from './use-track-import.ts'
import { WaveformCanvas } from './waveform-canvas.tsx'
import styles from './waveform-view.module.css'

interface WaveformViewProps {
  readonly state: TrackImportState
}

/**
 * Dumb presentational view of the import state: a prompt while idle, progress
 * while decoding, an alert on failure, and the amber waveform once loaded.
 */
export function WaveformView({ state }: WaveformViewProps) {
  switch (state.status) {
    case 'idle':
      return (
        <p className={styles.hint}>
          Importe un fichier audio pour afficher sa forme d'onde.
        </p>
      )
    case 'loading':
      return <p className={styles.hint}>Décodage…</p>
    case 'error':
      return (
        <p role="alert" className={styles.error}>
          {state.message}
        </p>
      )
    case 'loaded':
      return (
        <Stack gap="var(--space-xs)">
          <WaveformCanvas
            waveform={state.track.waveform}
            label="Forme d'onde de la piste"
          />
          <p className={styles.duration}>
            {formatSeconds(state.track.durationSeconds)}
          </p>
        </Stack>
      )
  }
}

/** Plain seconds readout. The mm:ss transport timecode lands in Slice 2. */
function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(1)} s`
}
