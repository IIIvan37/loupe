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
  /** The isolated stems' raw PCM, retained for the mixer and per-stem export. */
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
  /** Download one separated stem as a 16-bit WAV (no-op if its PCM is gone). */
  readonly downloadStem: (id: string) => void
  /**
   * Download ALL present stems as one zip of aligned WAVs (`01_Voix.wav`…,
   * t=0, same duration) named `<baseName>_stems.zip` — export tier A.
   */
  readonly exportStems: (baseName: string) => Promise<void>
  /** Why the last export did not happen — cleared by the next one. */
  readonly exportError: string | undefined
  readonly dismissExportError: () => void
  readonly reset: () => void
}

/**
 * Smart hook (= driving adapter logic): owns the separation state machine and
 * runs the `separateTrack` use-case, streaming the separator's progress into the
 * reducer. The separator defaults to the local-server engine (`createSeparator`)
 * and is injected (a stub) in tests, like the export's `ArchiveWriter` (zip).
 * The stems' raw PCM is kept in a ref (out of the pure domain state) so it can
 * be exported on demand.
 */
export function useSeparation(
  separator?: StemSeparator,
  archive?: ArchiveWriter
): Separation {
  const engine = useMemo(() => separator ?? createSeparator(), [separator])
  const [state, dispatch] = useReducer(separationReducer, initialSeparation)
  // A monotonic token per run: a slow separation that finishes after a new
  // import or reset is stale, and its late progress/result must not land on the
  // current track. Bumped by every `separate` and every `reset`.
  const runIdRef = useRef(0)
  // The isolated stems' raw PCM, kept off the pure domain state (heavy buffers)
  // but reactive so the mixer can load them into the gain graph when they land.
  const [sources, setSources] = useState<readonly SeparatedStem[]>([])
  const [exportError, setExportError] = useState<string>()

  // The whole pipeline behind both entry points: run `separateTrack` with the
  // given separator (the real engine, or the stored stems replayed) and commit.
  async function run(
    audio: DecodedAudio,
    separateWith: StemSeparator
  ): Promise<SeparationResult | undefined> {
    const runId = ++runIdRef.current
    setSources([])
    dispatch({ type: 'start' })
    const result = await separateTrack(
      { audio, bucketCount: BUCKET_COUNT },
      {
        separator: separateWith,
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
        setSources(result.sources)
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

  function downloadStem(id: string): void {
    const index = sources.findIndex((stem) => stem.id === id)
    const stem = sources[index]
    if (!stem) {
      return
    }
    const wav = encodeWav(stem.audio.channels, stem.audio.sampleRate)
    downloadBlob(
      stemExportFilename(index, stem.label),
      new Blob([wav], { type: 'audio/wav' })
    )
  }

  async function exportAllStems(baseName: string): Promise<void> {
    setExportError(undefined)
    // Export what the mixer shows: the present stems, in display order.
    const present = new Set<string>()
    for (const stem of state.stems) {
      if (stem.present) {
        present.add(stem.id)
      }
    }
    const result = await exportStems(
      { stems: sources.filter((stem) => present.has(stem.id)) },
      { archive: archive ?? createZipArchiveWriter() }
    )
    if (!result.ok) {
      setExportError(`L'export a échoué : ${result.error}`)
      return
    }
    downloadBlob(
      `${baseName}_stems.zip`,
      new Blob([result.archive], { type: 'application/zip' })
    )
  }

  function reset(): void {
    // Abandon any in-flight run so its late result can't repopulate the state.
    runIdRef.current++
    setSources([])
    setExportError(undefined)
    dispatch({ type: 'reset' })
  }

  return {
    state,
    sources,
    separate,
    restore,
    downloadStem,
    exportStems: exportAllStems,
    exportError,
    dismissExportError: () => setExportError(undefined),
    reset
  }
}
