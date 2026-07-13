import type { BeatGrid, DecodedAudio, OctaveFactor } from '@app/core'
import { useEffect, useRef } from 'react'
import { useLatest } from '../../lib/use-latest.ts'
import { DEFAULT_METRONOME_CHANNEL } from '../tempo/metronome-stem.ts'
import type { useMetronome } from '../tempo/use-metronome.ts'
import { useTapTempo } from '../tempo/use-tap-tempo.ts'
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
  /** Set the tempo by hand (typed or tapped) and seat the click for it. */
  readonly setBpm: (bpm: number) => void
  /** Correct the meter (beats per bar) and re-seat the click on the new bars. */
  readonly setMeter: (beatsPerBar: number) => void
  /** One tap of the tap-tempo sequence — lands on `setBpm` once readable. */
  readonly tap: () => void
  /** Anchor a downbeat on the playhead and re-seat the click for the grid. */
  readonly alignPhase: (playheadSeconds: number) => void
}

/** Whole-track length in seconds — a manual grid spans all of it. */
function durationOf(audio: DecodedAudio): number {
  return (audio.channels[0]?.length ?? 0) / audio.sampleRate
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
  const separationOwnsMixRef = useLatest(separationOwnsMix)

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

  // Held in a latest-ref so the effect keys on `loadedAudio` alone yet always
  // calls the live detect/enable (both read fresh state internally).
  const autoDetectRef = useLatest((audio: DecodedAudio | undefined) => {
    if (!audio) {
      return
    }
    // An open owns tempo/metronome seating for its restored audio — skip it here.
    if (suppressAutoDetectRef.current) {
      suppressAutoDetectRef.current = false
      return
    }
    runDetect(audio)
  })
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

  // Seat the click for a manually set grid: swap it when one is already in the
  // mix, seat it from scratch when the manual tempo is the FIRST tempo (the
  // tap/type fallback after a failed detection) — unless a separation owns the
  // mixer, where `enable` would clobber the stems (same rule as `runDetect`).
  function seatManualClick(grid: BeatGrid, audio: DecodedAudio): void {
    if (metronome.enabled) {
      metronome.reseat(grid, audio)
    } else if (!separationOwnsMixRef.current) {
      metronome.enable(grid, audio, DEFAULT_METRONOME_CHANNEL)
    }
  }

  function setBpm(bpm: number): void {
    if (!loadedAudio) {
      return
    }
    const overridden = tempo.overrideBpm(bpm, durationOf(loadedAudio))
    if (overridden) {
      seatManualClick(overridden.grid, loadedAudio)
    }
  }

  // The waveform grid and the chart header follow the corrected analysis on
  // their own; the click is re-seated so its accents land on the new bars.
  function setMeter(beatsPerBar: number): void {
    const corrected = tempo.overrideMeter(beatsPerBar)
    if (corrected && loadedAudio) {
      seatManualClick(corrected.grid, loadedAudio)
    }
  }

  function alignPhase(playheadSeconds: number): void {
    if (!loadedAudio) {
      return
    }
    const aligned = tempo.alignPhase(playheadSeconds, durationOf(loadedAudio))
    if (aligned) {
      seatManualClick(aligned.grid, loadedAudio)
    }
  }

  const tap = useTapTempo(setBpm)

  return {
    suppressNextAutoDetect: (suppress) => {
      suppressAutoDetectRef.current = suppress
    },
    retry,
    fold,
    setBpm,
    setMeter,
    tap,
    alignPhase
  }
}
