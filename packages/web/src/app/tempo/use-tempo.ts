import {
  type DecodedAudio,
  detectTempo,
  type TempoAnalysis,
  type TempoDetector
} from '@app/core'
import { useMemo, useRef, useState } from 'react'
import { createTempoDetector } from '../../audio/create-tempo-detector.ts'

export interface Tempo {
  /** The detected tempo + beat grid, or undefined until a run succeeds. */
  readonly analysis: TempoAnalysis | undefined
  /** Whether a detection is in flight (drives the busy button). */
  readonly detecting: boolean
  /** Why the last detection failed — cleared by the next run or a reset. */
  readonly error: string | undefined
  /** Detect the tempo of the already-loaded PCM (the SAME audio the player has). */
  readonly detect: (audio: DecodedAudio) => Promise<void>
  /** Forget the analysis — a fresh track has its own tempo. */
  readonly reset: () => void
}

/**
 * Smart hook (= driving adapter logic): runs the `detectTempo` use-case against
 * the tempo detector port (default: the local server; injected in tests) and
 * holds the render-ready analysis. A monotonic run token drops a slow detection
 * whose track was replaced by a reset before it resolved.
 */
export function useTempo(detector?: TempoDetector): Tempo {
  const engine = useMemo(() => detector ?? createTempoDetector(), [detector])
  const [analysis, setAnalysis] = useState<TempoAnalysis>()
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState<string>()
  const runIdRef = useRef(0)

  async function detect(audio: DecodedAudio): Promise<void> {
    const runId = ++runIdRef.current
    setDetecting(true)
    setError(undefined)
    const result = await detectTempo({ audio }, { detector: engine })
    // Commit only if this is still the latest run: a newer detect or a reset
    // since the await bumped the token, making this result stale.
    if (runIdRef.current === runId) {
      setDetecting(false)
      if (result.ok) {
        setAnalysis(result.analysis)
      } else {
        setError(result.error)
      }
    }
  }

  function reset(): void {
    // Abandon any in-flight run so its late result can't repopulate the state.
    runIdRef.current++
    setAnalysis(undefined)
    setDetecting(false)
    setError(undefined)
  }

  return { analysis, detecting, error, detect, reset }
}
