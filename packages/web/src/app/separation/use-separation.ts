import {
  type DecodedAudio,
  initialSeparation,
  type SeparationState,
  type StemSeparator,
  separateTrack,
  separationReducer
} from '@app/core'
import { useMemo, useReducer, useRef } from 'react'
import { createStubSeparator } from '../../audio/stub-separator.ts'

/** Per-stem peak resolution: enough for a compact track-list waveform. */
const BUCKET_COUNT = 240

export interface Separation {
  readonly state: SeparationState
  /** Separate the already-loaded PCM — the SAME audio the player decoded. */
  readonly separate: (audio: DecodedAudio) => Promise<void>
  readonly reset: () => void
}

/**
 * Smart hook (= driving adapter logic): owns the separation state machine and
 * runs the `separateTrack` use-case, streaming the separator's progress into the
 * reducer. The separator defaults to the stub adapter and is injected in tests.
 */
export function useSeparation(separator?: StemSeparator): Separation {
  const engine = useMemo(() => separator ?? createStubSeparator(), [separator])
  const [state, dispatch] = useReducer(separationReducer, initialSeparation)
  // A monotonic token per run: a slow separation that finishes after a new
  // import or reset is stale, and its late progress/result must not land on the
  // current track. Bumped by every `separate` and every `reset`.
  const runIdRef = useRef(0)

  async function separate(audio: DecodedAudio): Promise<void> {
    const runId = ++runIdRef.current
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
        dispatch({ type: 'ready', stems: result.stems })
      } else {
        dispatch({ type: 'fail', message: result.error })
      }
    }
  }

  function reset(): void {
    // Abandon any in-flight run so its late result can't repopulate the state.
    runIdRef.current++
    dispatch({ type: 'reset' })
  }

  return { state, separate, reset }
}
