import {
  buildManualGrid,
  DEFAULT_BEATS_PER_BAR,
  type DecodedAudio,
  detectTempo,
  foldTempoOctave,
  type ManualTempo,
  normalizeManualBpm,
  type OctaveFactor,
  type TempoAnalysis,
  type TempoDetector
} from '@app/core'
import { useEffect, useMemo, useRef, useState } from 'react'
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
   * The user-set tempo override (typed, tapped or phase-aligned), or undefined
   * while the analysis is the untouched detection. Signed with the session —
   * it is a user edit, unlike the derived detection.
   */
  readonly manual: ManualTempo | undefined
  /**
   * Replace the tempo with a user-set BPM: the beat grid is rebuilt at that
   * tempo over the whole track, anchored on the current downbeat phase (or the
   * track start when nothing was detected). Supersedes any in-flight detection
   * — the user's number is an authority, not a suggestion. Returns the new
   * analysis so the caller can re-seat the metronome, or undefined when the
   * input is not a tempo (NaN, zero, negative — an emptied field stays inert).
   */
  readonly overrideBpm: (
    bpm: number,
    durationSeconds: number
  ) => TempoAnalysis | undefined
  /**
   * Re-anchor the grid so a downbeat falls exactly on the given instant (the
   * musician pauses on beat one and calls this). Keeps the current tempo;
   * undefined when no tempo exists yet to anchor.
   */
  readonly alignPhase: (
    playheadSeconds: number,
    durationSeconds: number
  ) => TempoAnalysis | undefined
  /**
   * Seat a persisted analysis directly (opening a saved project) — no detection,
   * no server. Supersedes any in-flight detect so its late result can't win. The
   * octave shift restores the fold the user had applied (default 0), the manual
   * override restores the user-set tempo (default none).
   */
  readonly set: (
    analysis: TempoAnalysis,
    octaveShift?: number,
    manual?: ManualTempo
  ) => void
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
  const [manual, setManual] = useState<ManualTempo>()
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState<string>()
  const runIdRef = useRef(0)
  // The in-flight run's abort controller: a superseded run must release the
  // server's analysis slot, not just have its late result dropped.
  const controllerRef = useRef<AbortController | undefined>(undefined)

  /**
   * Supersede any in-flight run: bump the token AND abort its transfer.
   * Invariant: every abort goes through here (token bumped BEFORE the abort
   * settles) so the stale run's commit guard always mismatches — except the
   * unmount cleanup below, where every setState is a no-op anyway.
   */
  function supersede(): number {
    controllerRef.current?.abort()
    return ++runIdRef.current
  }

  // Unmounting mid-run must release the server's analysis slot too.
  useEffect(() => {
    return () => controllerRef.current?.abort()
  }, [])

  async function detect(
    audio: DecodedAudio
  ): Promise<TempoAnalysis | undefined> {
    const runId = supersede()
    const controller = new AbortController()
    controllerRef.current = controller
    setDetecting(true)
    setError(undefined)
    const result = await detectTempo(
      { audio, signal: controller.signal },
      { detector: engine }
    )
    // Commit only if this is still the latest run: a newer detect or a reset
    // since the await bumped the token, making this result stale.
    if (runIdRef.current === runId) {
      setDetecting(false)
      if (result.ok) {
        // A fresh detection starts from its own octave and supersedes any
        // manual override — clear the prior fold and the user-set tempo.
        setOctaveShift(0)
        setManual(undefined)
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
    // A fold over a manual override is still a user edit of that override —
    // its bpm follows so the save persists what the read-out shows.
    if (manual !== undefined) {
      setManual({ bpm: folded.bpm, phaseSeconds: manual.phaseSeconds })
    }
    setAnalysis(folded)
    return folded
  }

  /** Seat a user-set tempo: rebuild the grid and supersede any in-flight run. */
  function seatManual(
    next: ManualTempo,
    durationSeconds: number
  ): TempoAnalysis {
    const beatsPerBar = analysis?.beatsPerBar ?? DEFAULT_BEATS_PER_BAR
    const overridden: TempoAnalysis = {
      bpm: next.bpm,
      grid: buildManualGrid(next, beatsPerBar, durationSeconds),
      beatsPerBar
    }
    // The user's tempo is an authority: a late in-flight detection must not
    // overwrite it (same token dance as `set`).
    supersede()
    setDetecting(false)
    setError(undefined)
    setManual(next)
    setAnalysis(overridden)
    return overridden
  }

  function overrideBpm(
    bpm: number,
    durationSeconds: number
  ): TempoAnalysis | undefined {
    const normalized = normalizeManualBpm(bpm)
    if (normalized === undefined) {
      return undefined
    }
    // Keep the grid anchored where it is: the prior override's anchor, else
    // the detected downbeat phase, else the track start.
    const phaseSeconds =
      manual?.phaseSeconds ??
      analysis?.grid.find((beat) => beat.downbeat)?.timeSeconds ??
      analysis?.grid[0]?.timeSeconds ??
      0
    // A typed tempo is a new authority, not a fold of the detection.
    setOctaveShift(0)
    return seatManual({ bpm: normalized, phaseSeconds }, durationSeconds)
  }

  function alignPhase(
    playheadSeconds: number,
    durationSeconds: number
  ): TempoAnalysis | undefined {
    // Anchoring needs a tempo to lay out: the override's, else the detection's.
    const bpm = normalizeManualBpm(manual?.bpm ?? analysis?.bpm ?? Number.NaN)
    if (bpm === undefined) {
      return undefined
    }
    return seatManual({ bpm, phaseSeconds: playheadSeconds }, durationSeconds)
  }

  function set(next: TempoAnalysis, shift = 0, override?: ManualTempo): void {
    // Supersede any in-flight detect (bump the token) so its late result can't
    // overwrite the persisted analysis we are seating here.
    supersede()
    setDetecting(false)
    setError(undefined)
    setOctaveShift(shift)
    setManual(override)
    setAnalysis(next)
  }

  function reset(): void {
    // Abandon any in-flight run so its late result can't repopulate the state.
    supersede()
    setAnalysis(undefined)
    setOctaveShift(0)
    setManual(undefined)
    setDetecting(false)
    setError(undefined)
  }

  return {
    analysis,
    detecting,
    error,
    fold,
    octaveShift,
    manual,
    overrideBpm,
    alignPhase,
    detect,
    set,
    reset
  }
}
