import type { DecodedAudio, OctaveFactor } from '@app/core'
import { useEffect, useRef } from 'react'
import { DEFAULT_METRONOME_CHANNEL } from '../tempo/metronome-stem.ts'
import type { useMetronome } from '../tempo/use-metronome.ts'
import type { useTempo } from '../tempo/use-tempo.ts'

export interface TempoDetection {
  /**
   * One-shot guard: an open arms it before re-importing its bytes so the
   * auto-detect skips that audio (the open seats tempo itself).
   */
  readonly suppressNextAutoDetect: (suppress: boolean) => void
  /** Relaunch a failed detection (the panel's « Réessayer ») — same flow. */
  readonly retry: () => void
  /** Fold the tempo an octave (×2 / ÷2) and re-seat the click for it. */
  readonly fold: (factor: OctaveFactor) => void
}

/**
 * The detect → seat-the-metronome flow, off the shell: the tempo is detected
 * automatically the moment a track's PCM lands (import or project open) and the
 * always-on metronome is seated from the result — no button. The panel's
 * « Réessayer » re-runs the exact same flow after a failure, and an octave fold
 * re-renders the click for the folded grid.
 */
export function useTempoDetection({
  tempo,
  metronome,
  loadedAudio,
  separationOwnsMix
}: {
  readonly tempo: ReturnType<typeof useTempo>
  readonly metronome: ReturnType<typeof useMetronome>
  readonly loadedAudio: DecodedAudio | undefined
  /** A separation holds the mixer — `enable` would clobber its stems. */
  readonly separationOwnsMix: boolean
}): TempoDetection {
  const suppressAutoDetectRef = useRef(false)
  // Read at RESOLVE time (a separation can finish while a detection is in
  // flight — its stems must win over the late result's track+click seating).
  const separationOwnsMixRef = useRef(separationOwnsMix)
  separationOwnsMixRef.current = separationOwnsMix

  // One detection flow for the auto-run and the panel's « Réessayer »: run the
  // detector and seat the always-on metronome from the result. `enable` is the
  // UN-SEPARATED seating only (it restores the mixer to track + click, exactly
  // like the restore path's seatMetronome) — once a separation owns the mixer
  // the analysis still lands (BPM, grid, tempo map) but the mix stays intact.
  function runDetect(audio: DecodedAudio): void {
    void tempo.detect(audio).then((analysis) => {
      if (analysis && !separationOwnsMixRef.current) {
        // A freshly detected click joins the un-separated track muted by default.
        metronome.enable(analysis.grid, audio, DEFAULT_METRONOME_CHANNEL)
      }
    })
  }

  // Held in a ref so the effect keys on `loadedAudio` alone yet always calls
  // the live detect/enable (both read fresh state internally).
  const autoDetectRef = useRef<(audio: DecodedAudio | undefined) => void>(
    () => {}
  )
  autoDetectRef.current = (audio) => {
    if (!audio) {
      return
    }
    // An open owns tempo/metronome seating for its restored audio — skip it here.
    if (suppressAutoDetectRef.current) {
      suppressAutoDetectRef.current = false
      return
    }
    runDetect(audio)
  }
  useEffect(() => {
    autoDetectRef.current(loadedAudio)
  }, [loadedAudio])

  function retry(): void {
    if (loadedAudio) {
      runDetect(loadedAudio)
    }
  }

  // The BPM read-out and waveform grid follow the folded analysis on their own;
  // only the metronome stem needs re-seating.
  function fold(factor: OctaveFactor): void {
    const folded = tempo.fold(factor)
    if (folded && loadedAudio) {
      metronome.reseat(folded.grid, loadedAudio)
    }
  }

  return {
    suppressNextAutoDetect: (suppress) => {
      suppressAutoDetectRef.current = suppress
    },
    retry,
    fold
  }
}
