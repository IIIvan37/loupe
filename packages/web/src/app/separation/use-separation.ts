import {
  type DecodedAudio,
  initialSeparation,
  type SeparationState,
  type StemSeparator,
  separateTrack,
  separationReducer
} from '@app/core'
import { useMemo, useReducer } from 'react'
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

  async function separate(audio: DecodedAudio): Promise<void> {
    dispatch({ type: 'start' })
    const result = await separateTrack(
      { audio, bucketCount: BUCKET_COUNT },
      {
        separator: engine,
        onProgress: (progress) =>
          dispatch({
            type: 'progress',
            phase: progress.phase,
            fraction: progress.fraction
          })
      }
    )
    if (result.ok) {
      dispatch({ type: 'ready', stems: result.stems })
    } else {
      dispatch({ type: 'fail', message: result.error })
    }
  }

  function reset(): void {
    dispatch({ type: 'reset' })
  }

  return { state, separate, reset }
}
