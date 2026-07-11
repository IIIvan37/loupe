import {
  type ArchiveWriter,
  type DecodedAudio,
  encodeWav,
  exportStems,
  initialSeparation,
  type SeparatedStem,
  type SeparationState,
  type StemSeparator,
  type StemSet,
  separateTrack,
  separationReducer,
  stemExportFilename
} from '@app/core'
import { useLingui } from '@lingui/react/macro'
import { useMemo, useReducer, useRef, useState } from 'react'
import { createSeparator } from '../../audio/create-separator.ts'
import { downloadBlob } from '../../audio/download-blob.ts'
import { createZipArchiveWriter } from '../../audio/zip-archive-writer.ts'

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
   * the PRESENT stems — the same number the zip export gives it. Returns whether
   * a file was actually downloaded (false if the stem's PCM is gone).
   */
  readonly downloadStem: (id: string) => boolean
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
}

/** What the hook remembers of each separated stem — its identity, never its PCM. */
type StemDescriptor = Pick<SeparatedStem, 'id' | 'label'>

/**
 * Smart hook (= driving adapter logic): owns the separation state machine and
 * runs the `separateTrack` use-case, streaming the separator's progress into the
 * reducer. The separator defaults to the local-server engine (`createSeparator`)
 * and is injected (a stub) in tests, like the export's `ArchiveWriter` (zip).
 * The hook keeps only the stems' id/label: their PCM lives once, in the playback
 * engine's buffers, and `pcmOf` (the engine's `stemAudio`) reads it back
 * zero-copy for export and save — retaining it here too would double ~500 MB
 * on a six-stem track.
 */
export function useSeparation(
  pcmOf: (id: string) => DecodedAudio | undefined,
  separator?: StemSeparator,
  archive?: ArchiveWriter
): Separation {
  const { t } = useLingui()
  const engine = useMemo(() => separator ?? createSeparator(), [separator])
  const [state, dispatch] = useReducer(separationReducer, initialSeparation)
  // A monotonic token per run: a slow separation that finishes after a new
  // import or reset is stale, and its late progress/result must not land on the
  // current track. Bumped by every `separate` and every `reset`.
  const runIdRef = useRef(0)
  // The in-flight run's abort controller: cancel and reset abort it so the
  // server-side work is released, not just its result dropped.
  const controllerRef = useRef<AbortController | undefined>(undefined)
  // Which stems this separation produced — identities only, the PCM stays with
  // the engine. Reactive so consumers re-render when a run commits.
  const [descriptors, setDescriptors] = useState<readonly StemDescriptor[]>([])
  const [exportError, setExportError] = useState<string>()

  // The PCM-backed view of the separated stems, derived from the engine's
  // buffers (zero-copy channel views). Computed on demand — consumers are all
  // event handlers (save, export, attach), so rebuilding it per render would
  // be pure waste, and reading at call time always sees the live engine.
  function deriveSources(): readonly SeparatedStem[] {
    return descriptors.flatMap((descriptor) => {
      const audio = pcmOf(descriptor.id)
      return audio ? [{ ...descriptor, audio }] : []
    })
  }

  // The whole pipeline behind both entry points: run `separateTrack` with the
  // given separator (the real engine, or the stored stems replayed) and commit.
  async function run(
    audio: DecodedAudio,
    separateWith: StemSeparator
  ): Promise<SeparationResult | undefined> {
    const runId = ++runIdRef.current
    const controller = new AbortController()
    controllerRef.current = controller
    setDescriptors([])
    dispatch({ type: 'start' })
    const result = await separateTrack(
      { audio, bucketCount: BUCKET_COUNT },
      {
        separator: separateWith,
        signal: controller.signal,
        onProgress: (progress) => {
          if (runIdRef.current === runId) {
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
    if (runIdRef.current === runId) {
      if (result.ok) {
        // Remember identities only; the result's PCM is returned to the caller
        // (who loads it into the engine) and then released — never retained.
        setDescriptors(result.sources.map(({ id, label }) => ({ id, label })))
        dispatch({ type: 'ready', stems: result.stems })
        committed = { stems: result.stems, sources: result.sources }
      } else {
        dispatch({ type: 'fail', message: result.error })
      }
    }
    return committed
  }

  function separate(
    audio: DecodedAudio
  ): Promise<SeparationResult | undefined> {
    return run(audio, engine)
  }

  function restore(
    mix: DecodedAudio,
    sources: readonly SeparatedStem[]
  ): Promise<SeparationResult | undefined> {
    // A separator that just replays the stored stems — waveforms and instrument
    // detection are recomputed, exactly as after a live separation.
    return run(mix, { separate: async () => sources })
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

  function downloadStem(id: string): boolean {
    const shown = presentSources()
    const index = shown.findIndex((stem) => stem.id === id)
    const stem = shown[index]
    if (!stem) {
      return false
    }
    const wav = encodeWav(stem.audio.channels, stem.audio.sampleRate)
    downloadBlob(
      stemExportFilename(index, stem.label),
      new Blob([wav], { type: 'audio/wav' })
    )
    return true
  }

  async function exportAllStems(baseName: string): Promise<boolean> {
    setExportError(undefined)
    const runId = runIdRef.current
    const result = await exportStems(
      { stems: presentSources() },
      { archive: archive ?? createZipArchiveWriter() }
    )
    // A reset or a new import during the write supersedes this export: its
    // download and its error belong to the previous session — drop both.
    if (runIdRef.current !== runId) {
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
    controllerRef.current?.abort()
    runIdRef.current++
    setDescriptors([])
    dispatch({ type: 'reset' })
  }

  function reset(): void {
    // Abandon any in-flight run so its late result can't repopulate the state —
    // and abort its transfer, since nothing will consume it.
    controllerRef.current?.abort()
    runIdRef.current++
    setDescriptors([])
    setExportError(undefined)
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
    reset
  }
}
