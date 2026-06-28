import type { MouseEvent } from 'react'
import type { ImportState } from './use-player.ts'
import { WaveformCanvas } from './waveform-canvas.tsx'
import styles from './waveform-view.module.css'

interface WaveformViewProps {
  readonly state: ImportState
  /** Playhead position as a fraction (0–1) of the timeline. */
  readonly positionRatio: number
  /** Seek to a fraction (0–1) of the timeline (waveform click). */
  readonly onSeek: (ratio: number) => void
}

/**
 * Dumb presentational view of the import state: a prompt while idle, progress
 * while decoding, an alert on failure, and the amber waveform — with a playhead
 * and click-to-seek — once loaded.
 */
export function WaveformView({ state, positionRatio, onSeek }: WaveformViewProps) {
  function handleSeek(event: MouseEvent<HTMLButtonElement>): void {
    // Keyboard activation reports no coordinates (detail 0); keyboard seeking is
    // its own slice, so only a real pointer click seeks here.
    if (event.detail === 0) {
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0) {
      return
    }
    onSeek((event.clientX - rect.left) / rect.width)
  }

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
        <button
          type="button"
          className={styles.stage}
          aria-label="Se positionner dans la piste"
          onClick={handleSeek}
        >
          <WaveformCanvas
            waveform={state.track.waveform}
            label="Forme d'onde de la piste"
          />
          <span
            className={styles.playhead}
            style={{ left: `${playheadPercent(positionRatio)}%` }}
            aria-hidden="true"
          />
        </button>
      )
  }
}

/** Clamp the playhead to 0–100%, guarding a not-yet-known (NaN) ratio. */
function playheadPercent(ratio: number): number {
  if (Number.isNaN(ratio) || ratio < 0) {
    return 0
  }
  return Math.min(ratio, 1) * 100
}
