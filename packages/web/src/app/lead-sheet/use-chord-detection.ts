import {
  type BeatGrid,
  bassNotePerMeasure,
  type ChordDetectionErrorCode,
  type ChordDetector,
  type DecodedAudio,
  type DetectedSection,
  detectChords,
  downmixToMono,
  monoMixWithout,
  type SeparatedStem
} from '@app/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type EnsureTokenResult,
  ensureAnalysisToken,
  isAnalysisOffloaded
} from '../../audio/analysis-token.ts'
import { createChordDetector } from '../../audio/create-chord-detector.ts'
import type { MintFailureReason } from '../../auth/auth-port.ts'
import { nextPaint } from '../../lib/next-paint.ts'
import { useLatest } from '../../lib/use-latest.ts'
import { BASS_STEM_ID, DRUMS_STEM_ID } from '../stems/stem-ids.ts'
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
   * What the in-flight run is actually doing (AD.1): the implicit
   * separation is its own phase, so the busy face can say « Séparation des
   * pistes avant les accords… » instead of lying about a detection — and
   * skip the cold-start narration that belongs to the detector's engine.
   */
  readonly phase: 'separating' | 'detecting' | undefined
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
 * against the chord detector port (default: the Modal analysis service; injected in
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
  stems,
  ensureStems,
  cancelSeparation,
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
  /** The session's separated stems, when a separation already ran — the
   * detector then hears the mix minus drums (pre-beta point 4a). */
  readonly stems?: ReadonlyArray<SeparatedStem> | undefined
  /** Separate first when no stems exist yet (implicit, narrated by the
   * separation's own progress). Resolves undefined on failure/cancel — the
   * detection then falls back to the full mix, never blocks on it. */
  readonly ensureStems?:
    | (() => Promise<ReadonlyArray<SeparatedStem> | undefined>)
    | undefined
  /** Cancel the separation `ensureStems` started (AD.1): the chord item's
   * « Annuler » must stop the machine it set in motion, in one gesture. */
  readonly cancelSeparation?: (() => void) | undefined
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
  const [phase, setPhase] = useState<'separating' | 'detecting'>()
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
    setPhase(undefined)
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
    stems,
    ensureStems,
    cancelSeparation,
    onDraft
  })

  // The analysis mix + bass line for one (track, stems, grid) — recomputing
  // them per run both burns a synchronous DSP block AND hands the WAV-encode
  // memo (V.1, WeakMap on the audio's identity) a fresh object it can never
  // hit. Stem PCM is immutable for a loaded track, so the id list is an
  // honest key alongside the track's and grid's identities.
  const dspCacheRef = useRef<{
    audio: DecodedAudio
    grid: BeatGrid
    stemsKey: string
    analysisAudio: DecodedAudio
    bassNotes: ReadonlyArray<number | undefined> | undefined
  }>(undefined)

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
    // The run's identity, taken BEFORE the first await: a cancel (or a newer
    // detect) bumps the counter, and every await below re-checks it — a
    // superseded run must neither start the detector nor commit anything.
    const runId = ++runIdRef.current
    if (isAnalysisOffloaded()) {
      const gated = await gate()
      if (runIdRef.current !== runId) {
        return
      }
      if (!gated.ok) {
        setGateReason(gated.reason)
        setDetecting(false)
        setPhase(undefined)
        return
      }
    }
    // Stems first (4a): an already-separated session reuses its stems; a
    // fresh one separates implicitly — best-effort, a failure or cancel
    // falls back to the full mix. The run-id guard drops a run superseded
    // (cancel, newer detect, track swap) while the separation awaited.
    let stemsNow = inputRef.current.stems
    const separate = inputRef.current.ensureStems
    if (!stemsNow && separate) {
      setPhase('separating')
      stemsNow = await separate()
      if (
        runIdRef.current !== runId ||
        inputRef.current.loadedAudio !== audio
      ) {
        return
      }
    }
    setPhase('detecting')
    // No stems → the full mix, synchronously: the abort plumbing below must
    // hold the in-flight transfer the instant `detect` returns to its caller.
    let analysisAudio = audio
    let bassNotes: ReadonlyArray<number | undefined> | undefined
    if (stemsNow) {
      ;({ analysisAudio, bassNotes } = await analysisInputs(
        audio,
        beatGrid,
        stemsNow
      ))
      if (
        runIdRef.current !== runId ||
        inputRef.current.loadedAudio !== audio
      ) {
        return
      }
    }
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const result = await detectChords(
      {
        audio: analysisAudio,
        grid: beatGrid,
        barsPerRow: rows,
        beatsPerBar: bar,
        bassNotes,
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
    setPhase(undefined)
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

  /**
   * The DSP inputs of one run — the drums-less analysis mix (4a) and the
   * bass line (4b) — computed once per (track, stems, grid) and cached:
   * the synchronous block runs behind a painted busy face (`nextPaint`,
   * R.4) and is measured (`performance.measure('chords-dsp')`); a re-run
   * over the same session returns the SAME mix instance, which is what
   * lets the V.1 WAV-encode memo hit again.
   */
  async function analysisInputs(
    audio: DecodedAudio,
    beatGrid: BeatGrid,
    stemsNow: ReadonlyArray<SeparatedStem>
  ): Promise<{
    analysisAudio: DecodedAudio
    bassNotes: ReadonlyArray<number | undefined> | undefined
  }> {
    const stemsKey = stemsNow.map((stem) => stem.id).join('|')
    const cached = dspCacheRef.current
    if (
      cached &&
      cached.audio === audio &&
      cached.grid === beatGrid &&
      cached.stemsKey === stemsKey
    ) {
      return {
        analysisAudio: cached.analysisAudio,
        bassNotes: cached.bassNotes
      }
    }
    // Let the busy face PAINT before the synchronous DSP block freezes the
    // thread — nothing paints under a blocked main thread (R.4).
    await nextPaint()
    performance.mark('chords-dsp-start')
    const analysisAudio = monoMixWithout(stemsNow, DRUMS_STEM_ID) ?? audio
    const bassStem = stemsNow.find((stem) => stem.id === BASS_STEM_ID)
    const bassNotes = bassStem
      ? bassNotePerMeasure(
          downmixToMono(bassStem.audio.channels),
          bassStem.audio.sampleRate,
          beatGrid
        )
      : undefined
    performance.measure('chords-dsp', 'chords-dsp-start')
    dspCacheRef.current = {
      audio,
      grid: beatGrid,
      stemsKey,
      analysisAudio,
      bassNotes
    }
    return { analysisAudio, bassNotes }
  }

  /** Abort the in-flight run (R.2): the server slot is released, no outcome
   * is committed — cancelling is not a failure, so no error appears. And in
   * one gesture (AD.1): cancelling during the implicit separation also
   * cancels the separation this run started.
   */
  function cancel(): void {
    if (phase === 'separating') {
      inputRef.current.cancelSeparation?.()
    }
    controllerRef.current?.abort()
    runIdRef.current += 1
    setDetecting(false)
    setPhase(undefined)
  }

  return { detecting, error, gateReason, succeeded, phase, detect, cancel }
}
