import {
  type DecodedAudio,
  encodeWav,
  initialSeparation,
  type SeparatedStem,
  type SeparationState,
  type StemSeparator,
  separateTrack,
  separationReducer
} from '@app/core'
import { useMemo, useReducer, useRef } from 'react'
import { createSeparator } from '../../audio/create-separator.ts'
import { downloadBlob } from '../../audio/download-blob.ts'

/** Per-stem peak resolution: enough for a compact track-list waveform. */
const BUCKET_COUNT = 240

export interface Separation {
  readonly state: SeparationState
  /** Separate the already-loaded PCM — the SAME audio the player decoded. */
  readonly separate: (audio: DecodedAudio) => Promise<void>
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
  // The isolated stems' raw PCM, retained for export (kept off the domain state).
  const sourcesRef = useRef<readonly SeparatedStem[]>([])

  async function separate(audio: DecodedAudio): Promise<void> {
    const runId = ++runIdRef.current
    sourcesRef.current = []
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
    if (runIdRef.current === runId) {
      if (result.ok) {
        sourcesRef.current = result.sources
        dispatch({ type: 'ready', stems: result.stems })
      } else {
        dispatch({ type: 'fail', message: result.error })
      }
    }
  }

  function downloadStem(id: string): void {
    const index = sourcesRef.current.findIndex((stem) => stem.id === id)
    const stem = sourcesRef.current[index]
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
    sourcesRef.current = []
    dispatch({ type: 'reset' })
  }

  return { state, separate, downloadStem, reset }
}
