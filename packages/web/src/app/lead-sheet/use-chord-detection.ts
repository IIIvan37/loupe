import {
  type BeatGrid,
  type ChordDetectionErrorCode,
  type ChordDetector,
  type DecodedAudio,
  type DetectedSection,
  detectChords
} from '@app/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type EnsureTokenResult,
  ensureAnalysisToken,
  isAnalysisOffloaded
} from '../../audio/analysis-token.ts'
import { createChordDetector } from '../../audio/create-chord-detector.ts'
import type { MintFailureReason } from '../../auth/auth-port.ts'
import { useLatest } from '../../lib/use-latest.ts'
import {
  DEFAULT_BARS_PER_ROW,
  readStoredBarsPerRow
} from './bars-per-row-preference.ts'

export interface ChordDetection {
  /** Whether a detection is in flight (drives the busy button). */
  readonly detecting: boolean
  /**
   * Why the last detection failed, as a discriminated code the panel maps to
   * translated copy — cleared by the next run. The raw engine/transport
   * detail goes to the console, never the UI.
   */
  readonly error: ChordDetectionErrorCode | undefined
  /**
   * Why the analysis was BLOCKED before it ran (offload only, M1.1): the user
   * must sign in, redeem a code, or has spent the quota. A web-auth concern
   * kept out of the core's `error` codes — the shell opens the account menu on
   * it. Cleared by the next run.
   */
  readonly gateReason: MintFailureReason | undefined
  /** Whether the last run landed a draft (drives the a11y announcement). */
  readonly succeeded: boolean
  /**
   * Detect the loaded track's chords and hand the drafted grid source to
   * `onDraft`, wrapped at the given bars-per-row (the panel's layout).
   */
  readonly detect: (barsPerRow?: number) => Promise<void>
  /** Abort the in-flight run — offered as « Annuler » on the busy face. */
  readonly cancel: () => void
}

/**
 * Smart hook (= driving adapter logic): runs the `detectChords` use-case
 * against the chord detector port (default: the local server; injected in
 * tests) and lands the drafted grid SOURCE through `onDraft` — the same lifted
 * session state the panel edits, so the draft persists like any manual edit.
 * A monotonic run token drops a superseded detection, and the commit guard
 * re-checks the loaded audio's identity: a track replaced mid-flight must not
 * inherit the old one's chart.
 */
export function useChordDetection({
  loadedAudio,
  grid,
  beatsPerBar,
  sections,
  onDraft,
  detector,
  gate = ensureAnalysisToken
}: {
  readonly loadedAudio: DecodedAudio | undefined
  readonly grid: BeatGrid
  /** The session's felt bar length — the meter the draft's {time:} head
   * prints (a folded grid's raw beat density is not the meter). */
  readonly beatsPerBar?: number | undefined
  /** The song's already-known sections (the timeline's structure markers) —
   * the draft is cut by them so a prior structure detection is not erased. */
  readonly sections?: readonly DetectedSection[] | undefined
  readonly onDraft: (source: string) => void
  readonly detector?: ChordDetector | undefined
  /** Acquire the analyse token before running (offload gate, M1.1). Defaults
   * to the app gate; a no-op pass locally. Injected in tests. */
  readonly gate?: () => Promise<EnsureTokenResult>
}): ChordDetection {
  const engine = useMemo(() => detector ?? createChordDetector(), [detector])
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState<ChordDetectionErrorCode>()
  const [gateReason, setGateReason] = useState<MintFailureReason>()
  const [succeeded, setSucceeded] = useState(false)
  const runIdRef = useRef(0)
  // The in-flight run's abort controller: a superseded run must release the
  // server's analysis slot, not just have its late result dropped.
  const controllerRef = useRef<AbortController | undefined>(undefined)

  // A replaced track supersedes any in-flight run — its late result is
  // dropped by the commit guard below (audio identity), so no ref needs
  // touching here. State is adjusted inline during render (the prev-prop
  // idiom), not in an effect, so the busy state never paints one stale frame.
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
  // without re-identifying itself (the panel keys nothing on it).
  const inputRef = useLatest({
    loadedAudio,
    grid,
    beatsPerBar,
    sections,
    onDraft
  })

  // Abort in an EFFECT, not the render-time block above: the replaced track's
  // pending upload still holds the server's analysis slot, and an effect
  // cleanup is where a committed track change may touch the outside world.
  // The unmount cleanup also tears down whatever run is still in flight.
  // biome-ignore lint/correctness/useExhaustiveDependencies(loadedAudio): the cleanup deliberately keys on the track — replacing it aborts the previous track's run
  useEffect(() => {
    return () => controllerRef.current?.abort()
  }, [loadedAudio])

  async function detect(barsPerRow?: number): Promise<void> {
    // The layout preference is the panel's, persisted on blur — callers that
    // don't hold the live field (the analyser row) fall back to the stored
    // value so the detected draft matches the sheet's saved layout.
    const rows = barsPerRow ?? readStoredBarsPerRow() ?? DEFAULT_BARS_PER_ROW
    const {
      loadedAudio: audio,
      grid: beatGrid,
      beatsPerBar: bar,
      sections: known
    } = inputRef.current
    if (!audio) {
      return
    }
    // Gate first (offload only, M1.1): a token failure blocks the run and
    // tells the shell to open the account menu — the analysis never reaches
    // the core. The busy face goes up BEFORE the gate's mint round-trip
    // (R.3): the whole wait since the click is narrated.
    setGateReason(undefined)
    setDetecting(true)
    setError(undefined)
    setSucceeded(false)
    if (isAnalysisOffloaded()) {
      // A cancel (or a newer run) during the mint bumps the token — this
      // superseded run must not start the detector when the gate resolves.
      const ticket = runIdRef.current
      const gated = await gate()
      if (runIdRef.current !== ticket) {
        return
      }
      if (!gated.ok) {
        setGateReason(gated.reason)
        setDetecting(false)
        return
      }
    }
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const runId = ++runIdRef.current
    const result = await detectChords(
      {
        audio,
        grid: beatGrid,
        barsPerRow: rows,
        beatsPerBar: bar,
        sections: known,
        signal: controller.signal
      },
      { detector: engine }
    )
    // Commit only if this is still the latest run (no newer detect), the
    // track it analysed is still the loaded one (no swap since the await),
    // and the run was not aborted (an abort error is not an outcome).
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
      inputRef.current.onDraft(result.source)
    } else {
      // The code drives the translated UI copy; the raw detail (engine text,
      // HTTP status) is diagnosis-only, so it lands in the console.
      console.error('chord detection failed:', result.code, result.detail)
      setError(result.code)
    }
  }

  /** Abort the in-flight run (R.2): the server slot is released, no outcome
   * is committed — cancelling is not a failure, so no error appears. */
  function cancel(): void {
    controllerRef.current?.abort()
    runIdRef.current += 1
    setDetecting(false)
  }

  return { detecting, error, gateReason, succeeded, detect, cancel }
}
