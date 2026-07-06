import {
  type DecodedAudio,
  detectTempo,
  foldTempoOctave,
  type OctaveFactor,
  type TempoAnalysis,
  type TempoDetector
} from '@app/core'
import { useMemo, useRef, useState } from 'react'
import { createTempoDetector } from '../../audio/create-tempo-detector.ts'

/** How far the felt tempo may be nudged from the detection: ±2 octaves. */
const MAX_OCTAVE_SHIFT = 2

export interface Tempo {
  /** The detected tempo + beat grid, or undefined until a run succeeds. */
  readonly analysis: TempoAnalysis | undefined
  /** Whether a detection is in flight (drives the busy button). */
  readonly detecting: boolean
  /** Why the last detection failed — cleared by the next run or a reset. */
  readonly error: string | undefined
  /**
   * Detect the tempo of the already-loaded PCM (the SAME audio the player has).
   * Resolves with the analysis so the caller can act on it in the same handler
   * (e.g. seat the metronome stem), or undefined if detection failed/was stale.
   */
  readonly detect: (audio: DecodedAudio) => Promise<TempoAnalysis | undefined>
  /**
   * Fold the current analysis an octave (×2 doubles the felt tempo, ÷2 halves
   * it) and track the cumulative shift. Returns the folded analysis so the caller
   * can re-seat the metronome, or undefined when there is nothing to fold or the
   * shift is already at its bound.
   */
  readonly fold: (factor: OctaveFactor) => TempoAnalysis | undefined
  /**
   * How far the tempo has been folded from the detection: +1 per ×2, −1 per ÷2,
   * clamped to ±2. Zero on a fresh detection; restored from a saved project.
   */
  readonly octaveShift: number
  /**
   * Seat a persisted analysis directly (opening a saved project) — no detection,
   * no server. Supersedes any in-flight detect so its late result can't win. The
   * octave shift restores the fold the user had applied (default 0).
   */
  readonly set: (analysis: TempoAnalysis, octaveShift?: number) => void
  /** Forget the analysis — a fresh track has its own tempo. */
  readonly reset: () => void
}

/**
 * Smart hook (= driving adapter logic): runs the `detectTempo` use-case against
 * the tempo detector port (default: the local server; injected in tests) and
 * holds the render-ready analysis. A monotonic run token drops a slow detection
 * whose track was replaced by a reset before it resolved.
 */
export function useTempo(detector?: TempoDetector): Tempo {
  const engine = useMemo(() => detector ?? createTempoDetector(), [detector])
  const [analysis, setAnalysis] = useState<TempoAnalysis>()
  const [octaveShift, setOctaveShift] = useState(0)
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState<string>()
  const runIdRef = useRef(0)

  async function detect(
    audio: DecodedAudio
  ): Promise<TempoAnalysis | undefined> {
    const runId = ++runIdRef.current
    setDetecting(true)
    setError(undefined)
    const result = await detectTempo({ audio }, { detector: engine })
    // Commit only if this is still the latest run: a newer detect or a reset
    // since the await bumped the token, making this result stale.
    if (runIdRef.current === runId) {
      setDetecting(false)
      if (result.ok) {
        // A fresh detection starts from its own octave — clear any prior fold.
        setOctaveShift(0)
        setAnalysis(result.analysis)
        return result.analysis
      }
      setError(result.error)
    }
    return undefined
  }

  function fold(factor: OctaveFactor): TempoAnalysis | undefined {
    if (analysis === undefined) {
      return undefined
    }
    const delta = factor === 2 ? 1 : -1
    const next = Math.max(
      -MAX_OCTAVE_SHIFT,
      Math.min(MAX_OCTAVE_SHIFT, octaveShift + delta)
    )
    if (next === octaveShift) {
      return undefined
    }
    // Folding is an octave correction, not a re-reading of the meter — carry the
    // detected beatsPerBar through unchanged.
    const folded: TempoAnalysis = {
      ...foldTempoOctave(analysis, factor),
      beatsPerBar: analysis.beatsPerBar
    }
    setOctaveShift(next)
    setAnalysis(folded)
    return folded
  }

  function set(next: TempoAnalysis, shift = 0): void {
    // Supersede any in-flight detect (bump the token) so its late result can't
    // overwrite the persisted analysis we are seating here.
    runIdRef.current++
    setDetecting(false)
    setError(undefined)
    setOctaveShift(shift)
    setAnalysis(next)
  }

  function reset(): void {
    // Abandon any in-flight run so its late result can't repopulate the state.
    runIdRef.current++
    setAnalysis(undefined)
    setOctaveShift(0)
    setDetecting(false)
    setError(undefined)
  }

  return { analysis, detecting, error, fold, octaveShift, detect, set, reset }
}
