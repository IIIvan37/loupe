import type { DecodedAudio } from '@app/core'
import { useLatest } from '../../lib/use-latest.ts'
import type { Mixer } from '../mixer/use-mixer.ts'
import { DEFAULT_METRONOME_CHANNEL } from './metronome-stem.ts'
import { useMetronome } from './use-metronome.ts'
import { useTempo } from './use-tempo.ts'

/**
 * The one detect → seat-the-click flow, shared by the auto-run on import, the
 * panel's « Réessayer » and the gated-analysis replay: run the detector and
 * seat the always-on metronome from the result. Tempo and metronome are
 * session state (ADR 0010), so every derived instance runs the exact flow the
 * shell's would — only the mixer seam and a value come in, never a hook bag.
 * No effect lives here: instantiating it anywhere is free.
 */
export function useRunTempoDetection({
  mixer,
  separationOwnsMix
}: {
  /** The mix the click seats into — the shell stack's instance (the engine
   * seam, same idiom as `MetronomeDeps`). */
  readonly mixer: Mixer
  /** A separation holds the mixer — `enable` would clobber its stems. */
  readonly separationOwnsMix: boolean
}): (audio: DecodedAudio) => void {
  const tempo = useTempo()
  const metronome = useMetronome({ mixer })
  // Read at RESOLVE time (a separation can finish while a detection is in
  // flight — its stems must win over the late result's track+click seating).
  const separationOwnsMixRef = useLatest(separationOwnsMix)
  // `enable` is the UN-SEPARATED seating only (it restores the mixer to
  // track + click, exactly like the restore path's seatMetronome) — once a
  // separation owns the mixer the analysis still lands (BPM, grid, tempo map)
  // but the mix stays intact.
  return (audio) => {
    void tempo.detect(audio).then((analysis) => {
      if (analysis && !separationOwnsMixRef.current) {
        // A freshly detected click joins the un-separated track muted by default.
        metronome.enable(analysis.grid, audio, DEFAULT_METRONOME_CHANNEL)
      }
    })
  }
}
