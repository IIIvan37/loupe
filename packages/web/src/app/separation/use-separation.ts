import {
  type DecodedAudio,
  encodeWav,
  initialSeparation,
  type SeparatedStem,
  type SeparationState,
  type StemSeparator,
  type StemSet,
  separateTrack,
  separationReducer
} from '@app/core'
import { useMemo, useReducer, useRef, useState } from 'react'
import { createSeparator } from '../../audio/create-separator.ts'
import { downloadBlob } from '../../audio/download-blob.ts'

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
  /** Download one separated stem as a 16-bit WAV (no-op if its PCM is gone). */
  readonly downloadStem: (id: string) => void
  readonly reset: () => void
}

/** `01_Voix.wav` — numbered, in display order, for a tidy stem folder. */
function stemFilename(index: number, label: string): string {
  return `${String(index + 1).padStart(2, '0')}_${label}.wav`
}

/**
 * Smart hook (= driving adapter logic): owns the separation state machine and
 * runs the `separateTrack` use-case, streaming the separator's progress into the
 * reducer. The separator defaults to the local-server engine (`createSeparator`)
 * and is injected (a stub) in tests. The stems' raw PCM is kept in a ref (out of the
 * pure domain state) so it can be exported on demand.
 */
export function useSeparation(separator?: StemSeparator): Separation {
  const engine = useMemo(() => separator ?? createSeparator(), [separator])
  const [state, dispatch] = useReducer(separationReducer, initialSeparation)
  // A monotonic token per run: a slow separation that finishes after a new
  // import or reset is stale, and its late progress/result must not land on the
  // current track. Bumped by every `separate` and every `reset`.
  const runIdRef = useRef(0)
  // The isolated stems' raw PCM, kept off the pure domain state (heavy buffers)
  // but reactive so the mixer can load them into the gain graph when they land.
  const [sources, setSources] = useState<readonly SeparatedStem[]>([])

  async function separate(
    audio: DecodedAudio
  ): Promise<SeparationResult | undefined> {
    const runId = ++runIdRef.current
    setSources([])
    dispatch({ type: 'start' })
    const result = await separateTrack(
      { audio, bucketCount: BUCKET_COUNT },
      {
        separator: engine,
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

  function downloadStem(id: string): void {
    const index = sources.findIndex((stem) => stem.id === id)
    const stem = sources[index]
    if (!stem) {
      return
    }
    const wav = encodeWav(stem.audio.channels, stem.audio.sampleRate)
    downloadBlob(
      stemFilename(index, stem.label),
      new Blob([wav], { type: 'audio/wav' })
    )
  }

  function reset(): void {
    // Abandon any in-flight run so its late result can't repopulate the state.
    runIdRef.current++
    setSources([])
    dispatch({ type: 'reset' })
  }

  return { state, sources, separate, downloadStem, reset }
}
