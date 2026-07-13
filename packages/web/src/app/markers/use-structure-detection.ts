import {
  type BeatGrid,
  type DecodedAudio,
  type DetectedSection,
  detectStructure,
  type StructureDetectionErrorCode,
  type StructureDetector
} from '@app/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type EnsureTokenResult,
  ensureAnalysisToken,
  isAnalysisOffloaded
} from '../../audio/analysis-token.ts'
import { createStructureDetector } from '../../audio/create-structure-detector.ts'
import type { MintFailureReason } from '../../auth/auth-port.ts'
import { useLatest } from '../../lib/use-latest.ts'

export interface StructureDetection {
  /** Whether a detection is in flight (drives the busy button). */
  readonly detecting: boolean
  /**
   * Why the last detection failed, as a discriminated code the control maps to
   * translated copy — cleared by the next run. The raw engine/transport detail
   * goes to the console, never the UI.
   */
  readonly error: StructureDetectionErrorCode | undefined
  /**
   * Why the analysis was BLOCKED before it ran (offload only): the user must
   * sign in, redeem a code, or has spent the quota. A web-auth concern kept out
   * of the core's `error` codes — the shell opens the account menu on it.
   * Cleared by the next run.
   */
  readonly gateReason: MintFailureReason | undefined
  /** Whether the last run landed sections (drives the a11y announcement). */
  readonly succeeded: boolean
  /** Detect the loaded track's structure and hand the sections to `onSections`. */
  readonly detect: () => Promise<void>
}

/**
 * Smart hook (= driving adapter logic): runs the `detectStructure` use-case
 * against the structure detector port (default: the local server; injected in
 * tests) and hands the snapped sections to `onSections` — the owner turns them
 * into labelled markers. Mirrors `useChordDetection`: a monotonic run token
 * drops a superseded detection, and the commit guard re-checks the loaded
 * audio's identity so a track replaced mid-flight never inherits the old one's
 * sections. Unlike chords the grid may be empty — structure detection works
 * before the tempo is known (the use-case then skips snapping).
 */
export function useStructureDetection({
  loadedAudio,
  grid,
  onSections,
  detector,
  gate = ensureAnalysisToken
}: {
  readonly loadedAudio: DecodedAudio | undefined
  readonly grid: BeatGrid
  readonly onSections: (sections: readonly DetectedSection[]) => void
  readonly detector?: StructureDetector | undefined
  /** Acquire the analyse token before running (offload gate). Defaults to the
   * app gate; a no-op pass locally. Injected in tests. */
  readonly gate?: () => Promise<EnsureTokenResult>
}): StructureDetection {
  const engine = useMemo(
    () => detector ?? createStructureDetector(),
    [detector]
  )
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState<StructureDetectionErrorCode>()
  const [gateReason, setGateReason] = useState<MintFailureReason>()
  const [succeeded, setSucceeded] = useState(false)
  const runIdRef = useRef(0)
  // The in-flight run's abort controller: a superseded run must release the
  // server's analysis slot, not just have its late result dropped.
  const controllerRef = useRef<AbortController | undefined>(undefined)

  // A replaced track supersedes any in-flight run — its late result is dropped
  // by the commit guard below (audio identity). State is adjusted inline during
  // render (the prev-prop idiom), not in an effect, so the busy state never
  // paints one stale frame.
  const [prevAudio, setPrevAudio] = useState(loadedAudio)
  if (prevAudio !== loadedAudio) {
    setPrevAudio(loadedAudio)
    setDetecting(false)
    // The outcome belongs to the replaced track: a stale error (or a stale
    // success announcement) must not survive onto the new one.
    setError(undefined)
    setGateReason(undefined)
    setSucceeded(false)
  }

  // Held in a latest-ref so `detect` always reads the committed-fresh values
  // without re-identifying itself.
  const inputRef = useLatest({ loadedAudio, grid, onSections })

  // Abort in an EFFECT, not the render-time block above: the replaced track's
  // pending upload still holds the server's analysis slot, and an effect
  // cleanup is where a committed track change may touch the outside world. The
  // unmount cleanup also tears down whatever run is still in flight.
  // biome-ignore lint/correctness/useExhaustiveDependencies(loadedAudio): the cleanup deliberately keys on the track — replacing it aborts the previous track's run
  useEffect(() => {
    return () => controllerRef.current?.abort()
  }, [loadedAudio])

  async function detect(): Promise<void> {
    const { loadedAudio: audio, grid: beatGrid } = inputRef.current
    if (!audio) {
      return
    }
    // Gate first (offload only): a token failure blocks the run and tells the
    // shell to open the account menu — the analysis never reaches the core.
    // Only awaited when offloaded, so the token-less local path starts the
    // detector synchronously (the abort/busy semantics below rely on that).
    setGateReason(undefined)
    if (isAnalysisOffloaded()) {
      const gated = await gate()
      if (!gated.ok) {
        setGateReason(gated.reason)
        return
      }
    }
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const runId = ++runIdRef.current
    setDetecting(true)
    setError(undefined)
    setSucceeded(false)
    const result = await detectStructure(
      { audio, grid: beatGrid, signal: controller.signal },
      { detector: engine }
    )
    // Commit only if this is still the latest run (no newer detect), the track
    // it analysed is still the loaded one (no swap since the await), and the
    // run was not aborted (an abort error is not an outcome).
    if (
      runIdRef.current !== runId ||
      inputRef.current.loadedAudio !== audio ||
      controller.signal.aborted
    ) {
      return
    }
    setDetecting(false)
    if (result.ok) {
      setSucceeded(true)
      inputRef.current.onSections(result.sections)
    } else {
      // The code drives the translated UI copy; the raw detail (engine text,
      // HTTP status) is diagnosis-only, so it lands in the console.
      console.error('structure detection failed:', result.code, result.detail)
      setError(result.code)
    }
  }

  return { detecting, error, gateReason, succeeded, detect }
}
