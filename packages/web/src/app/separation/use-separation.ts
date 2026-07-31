import {
  type ArchiveWriter,
  type DecodedAudio,
  encodeWav,
  exportStems,
  type SeparatedStem,
  type SeparationAction,
  type SeparationState,
  type StemSeparator,
  type StemSet,
  separateTrack,
  separationReducer,
  stemExportFilename
} from '@app/core'
import { useLingui } from '@lingui/react/macro'
import { useAtom, useAtomValue } from 'jotai'
import { useEffect, useMemo, useRef } from 'react'
import { createSeparator } from '../../audio/create-separator.ts'
import { downloadBlob } from '../../audio/download-blob.ts'
import { createZipArchiveWriter } from '../../audio/encode/zip-archive-writer.ts'
import {
  type EnsureTokenResult,
  ensureAnalysisToken,
  isAnalysisOffloaded
} from '../../auth/analysis-token.ts'
import type { MintFailureReason } from '../../auth/auth-port.ts'
import {
  useAudioSession,
  useStemAudio
} from '../audio-session/audio-session.ts'
import {
  separationDescriptorsAtom,
  separationExportErrorAtom,
  separationGateReasonAtom,
  separationRunAtom,
  separationStateAtom
} from './separation-atoms.ts'

// Per-stem peak resolution. Matches the main view's, so the stems sum cleanly
// into the audible-mix waveform shown there and the lanes stay crisp when zoomed.
const BUCKET_COUNT = 1200

/** The committed outcome of a separation run: render-ready stems + their PCM. */
export interface SeparationResult {
  readonly stems: StemSet
  readonly sources: readonly SeparatedStem[]
}

export interface Separation {
  readonly state: SeparationState
  /**
   * The isolated stems joined with their PCM, re-derived on read from the
   * playback engine's buffers (the PCM's only custodian) — the hook retains no
   * copy of its own. A stem whose PCM the engine no longer holds is omitted.
   */
  readonly sources: readonly SeparatedStem[]
  /**
   * Separate the already-loaded PCM — the SAME audio the player decoded.
   * Resolves with the committed result, or `undefined` if it failed or a newer
   * run superseded it (so the caller can wire the mixer in this same handler).
   */
  readonly separate: (
    audio: DecodedAudio
  ) => Promise<SeparationResult | undefined>
  /**
   * Rebuild the ready state from a project's persisted stems: the same pipeline
   * as `separate` (waveforms + instrument detection re-run over the PCM), but
   * fed the stored stems instead of the separator port.
   */
  readonly restore: (
    mix: DecodedAudio,
    sources: readonly SeparatedStem[]
  ) => Promise<SeparationResult | undefined>
  /**
   * Download one separated stem as a 16-bit WAV. Numbered by its position among
   * the PRESENT stems — the same number the zip export gives it. Resolves with
   * whether a file was actually delivered (false if the stem's PCM is gone).
   */
  readonly downloadStem: (id: string) => Promise<boolean>
  /**
   * Download ALL present stems as one zip of aligned WAVs (`01_Voix.wav`…,
   * t=0, same duration) named `<baseName>_stems.zip` — export tier A. Resolves
   * with whether the zip was actually downloaded (false on failure or if a
   * reset/new import superseded the export mid-write).
   */
  readonly exportStems: (baseName: string) => Promise<boolean>
  /** Why the last export did not happen — cleared by the next one. */
  readonly exportError: string | undefined
  readonly dismissExportError: () => void
  /** Abort the in-flight run and return to idle; a no-op when none runs. */
  readonly cancel: () => void
  readonly reset: () => void
  /** Why the offload gate blocked the last run (M1.3) — the account menu
   * explains; cleared by the next run or a reset. */
  readonly gateReason: MintFailureReason | undefined
}

/**
 * Smart hook (= driving adapter logic): runs the `separateTrack` use-case,
 * streaming the separator's progress into the core's `separationReducer`. The
 * whole bag is owned by the feature (ADR 0010): every field lives in an atom,
 * so any consumer instance sees the same session separation — run token
 * included, since a superseded run must release the server-side work and the
 * superseder may be another instance (the analyser row's cancel). The
 * separator defaults to the session's port, else the real engine
 * (`createSeparator`); the export's `ArchiveWriter` (zip) works the same. The
 * feature keeps only the stems' id/label: their PCM lives once, in the
 * playback engine's buffers, and `pcmOf` — defaulting to the seam's narrow
 * custody interface, `StemAudioSource` — reads it back zero-copy for export
 * and save; retaining it here too would double ~500 MB on a six-stem track.
 */
export function useSeparation(
  pcmOf?: (id: string) => DecodedAudio | undefined,
  separator?: StemSeparator,
  archive?: ArchiveWriter,
  /** Acquire the analyse token before a live run (offload gate, M1.3).
   * Defaults to the app gate; a no-op pass locally. Injected in tests. */
  gate: () => Promise<EnsureTokenResult> = ensureAnalysisToken
): Separation {
  const { t } = useLingui()
  const session = useAudioSession()
  // The stems' PCM, reached through the seam's narrow custody interface: this
  // feature reads samples back, it has no business with the engine's fourteen
  // other members (DIP).
  const stems = useStemAudio()
  const injected = separator ?? session.separator
  const engine = useMemo(() => injected ?? createSeparator(), [injected])
  // The state machine's transitions stay in the core reducer; the atom only
  // carries its current state (ADR 0010's anti-erosion guard).
  const [state, setState] = useAtom(separationStateAtom)
  const [descriptors, setDescriptors] = useAtom(separationDescriptorsAtom)
  const [exportError, setExportError] = useAtom(separationExportErrorAtom)
  const [gateReason, setGateReason] = useAtom(separationGateReasonAtom)
  // The session's single run (token + in-flight abort controller), shared by
  // every instance. The box is mutated in place — bookkeeping, never rendered.
  const run = useAtomValue(separationRunAtom)
  // The controllers THIS instance created, for the unmount cleanup only — a
  // read-only consumer unmounting must not abort a run it never started.
  const myControllerRef = useRef<AbortController | undefined>(undefined)

  function dispatch(action: SeparationAction): void {
    setState((prev) => separationReducer(prev, action))
  }

  /** Supersede any in-flight run: bump the token AND abort its transfer, so
   * the server-side work is released, not just its result dropped. */
  function supersede(): number {
    run.controller?.abort()
    return ++run.runId
  }

  // Unmounting mid-run must release the transfer and the server-side work too
  // (cancel/reset already do) — same cleanup as useTempo's.
  useEffect(() => {
    return () => myControllerRef.current?.abort()
  }, [])

  // The PCM-backed view of the separated stems, derived from the engine's
  // buffers (zero-copy channel views). Computed on demand — consumers are all
  // event handlers (save, export, attach), so rebuilding it per render would
  // be pure waste, and reading at call time always sees the live engine. The
  // injected reader is the shell stack's; a bare consumer reads the same
  // engine through the audio session (ADR 0011).
  function readPcm(id: string): DecodedAudio | undefined {
    return pcmOf ? pcmOf(id) : stems?.stemAudio(id)
  }

  function deriveSources(): readonly SeparatedStem[] {
    return descriptors.flatMap((descriptor) => {
      const audio = readPcm(descriptor.id)
      return audio ? [{ ...descriptor, audio }] : []
    })
  }

  // The whole pipeline behind both entry points: run `separateTrack` with the
  // given separator (the real engine, or the stored stems replayed) and commit.
  async function runSeparation(
    audio: DecodedAudio,
    separateWith: StemSeparator
  ): Promise<SeparationResult | undefined> {
    const runId = supersede()
    const controller = new AbortController()
    run.controller = controller
    myControllerRef.current = controller
    setDescriptors([])
    dispatch({ type: 'start' })
    const result = await separateTrack(
      { audio, bucketCount: BUCKET_COUNT },
      {
        separator: separateWith,
        signal: controller.signal,
        onProgress: (progress) => {
          if (run.runId === runId) {
            dispatch({
              type: 'progress',
              phase: progress.phase,
              fraction: progress.fraction
            })
          }
        }
      }
    )
    // Commit only if this is still the latest run (a newer separate/reset since
    // the await would have bumped the token, making this result stale).
    let committed: SeparationResult | undefined
    if (run.runId === runId) {
      if (result.ok) {
        // Remember identities only; the result's PCM is returned to the caller
        // (who loads it into the engine) and then released — never retained.
        setDescriptors(result.sources.map(({ id, label }) => ({ id, label })))
        dispatch({ type: 'ready', stems: result.stems })
        committed = { stems: result.stems, sources: result.sources }
      } else {
        // The translated copy speaks for the code; the raw detail is for
        // debugging only — same contract as the detections (N.1, M1.4).
        console.error('separation failed:', result.code, result.detail)
        dispatch({ type: 'fail', code: result.code, detail: result.detail })
      }
    }
    return committed
  }

  async function separate(
    audio: DecodedAudio
  ): Promise<SeparationResult | undefined> {
    setGateReason(undefined)
    // Gate first (offload only, M1.3): a token failure blocks the run — the
    // 42 MB upload never starts — and the shell opens the account menu on the
    // reason. The busy face goes up BEFORE the gate's mint round-trip (R.3).
    if (isAnalysisOffloaded()) {
      const runId = supersede()
      dispatch({ type: 'start' })
      const gated = await gate()
      // A cancel (or a newer run) during the mint bumped the token — this
      // superseded run must not start the separator when the gate resolves.
      if (run.runId !== runId) {
        return undefined
      }
      if (!gated.ok) {
        setGateReason(gated.reason)
        dispatch({ type: 'reset' })
        return undefined
      }
    }
    return runSeparation(audio, engine)
  }

  function restore(
    mix: DecodedAudio,
    sources: readonly SeparatedStem[]
  ): Promise<SeparationResult | undefined> {
    // A separator that just replays the stored stems — waveforms and instrument
    // detection are recomputed, exactly as after a live separation.
    return runSeparation(mix, { separate: async () => sources })
  }

  // What the mixer shows, joined with its PCM: the present stems in display
  // order — the ONE numbering basis shared by the single-file download and the
  // zip export (the same stem must carry the same number in both).
  function presentSources(): readonly SeparatedStem[] {
    const present = new Set<string>()
    for (const stem of state.stems) {
      if (stem.present) {
        present.add(stem.id)
      }
    }
    return deriveSources().filter((stem) => present.has(stem.id))
  }

  function downloadStem(id: string): Promise<boolean> {
    const shown = presentSources()
    const index = shown.findIndex((stem) => stem.id === id)
    const stem = shown[index]
    if (!stem) {
      return Promise.resolve(false)
    }
    const wav = encodeWav(stem.audio.channels, stem.audio.sampleRate)
    downloadBlob(
      stemExportFilename(index, stem.label),
      new Blob([wav], { type: 'audio/wav' })
    )
    return Promise.resolve(true)
  }

  async function exportAllStems(baseName: string): Promise<boolean> {
    setExportError(undefined)
    const runId = run.runId
    const result = await exportStems(
      { stems: presentSources() },
      { archive: archive ?? createZipArchiveWriter() }
    )
    // A reset or a new import during the write supersedes this export: its
    // download and its error belong to the previous session — drop both.
    if (run.runId !== runId) {
      return false
    }
    if (result.ok) {
      downloadBlob(
        `${baseName}_stems.zip`,
        new Blob([result.archive], { type: 'application/zip' })
      )
      return true
    }
    // The raw port error stays untranslated; only the frame is copy.
    const error = result.error
    setExportError(
      t({
        id: 'separation.export-failed',
        message: `L'export a échoué : ${error}`
      })
    )
    return false
  }

  function cancel(): void {
    // Abort the transfer (releasing the server-side work) and supersede the
    // run: its rejection resolves as a stale result, never as an error.
    supersede()
    setDescriptors([])
    dispatch({ type: 'reset' })
  }

  function reset(): void {
    // Abandon any in-flight run so its late result can't repopulate the state —
    // and abort its transfer, since nothing will consume it.
    supersede()
    setDescriptors([])
    setExportError(undefined)
    setGateReason(undefined)
    dispatch({ type: 'reset' })
  }

  return {
    state,
    get sources() {
      return deriveSources()
    },
    separate,
    restore,
    downloadStem,
    exportStems: exportAllStems,
    exportError,
    dismissExportError: () => setExportError(undefined),
    cancel,
    reset,
    gateReason
  }
}
