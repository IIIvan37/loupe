import {
  recordLoopPass,
  type SpeedTrainerPolicy,
  type SpeedTrainerState,
  startSpeedTrainer
} from '@app/core'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useLatest } from '../../lib/use-latest.ts'

export interface SpeedTrainer {
  /** The running ramp, or undefined when the trainer is off. */
  readonly state: SpeedTrainerState | undefined
  /** Arm the ramp: memorises the current tempo, then seats the start tempo. */
  readonly start: (policy: SpeedTrainerPolicy) => void
  /** Stop practising — restores the tempo memorised at arming. */
  readonly stop: () => void
  /** One completed loop pass (wrap-around). Inert while the trainer is off. */
  readonly recordPass: () => void
}

/**
 * Smart hook owning the speed-trainer ramp (`startSpeedTrainer` /
 * `recordLoopPass`): the transport's position listener reports each completed
 * pass through `recordPass`, and every earned step lands on the player
 * through `applyTempoPercent` — inside the handler itself, so the tempo
 * changes the instant the pass wraps, not a render later. Arming memorises
 * the player's tempo (`currentTempoPercent`) and stopping restores it — the
 * ramp borrows the tempo, it never keeps it. That listener is mount-once, so
 * `recordPass` reads the live ramp from a ref (`stateRef` is the source of
 * truth; `useState` mirrors it for render — every transition must write
 * both). All returned identities are stable: the host re-renders per
 * animation frame during playback, and an unstable return would defeat the
 * memoised controls.
 */
export function useSpeedTrainer(
  applyTempoPercent: (percent: number) => void,
  currentTempoPercent: () => number
): SpeedTrainer {
  const [state, setState] = useState<SpeedTrainerState | undefined>(undefined)
  const stateRef = useRef<SpeedTrainerState | undefined>(undefined)
  const applyRef = useLatest(applyTempoPercent)
  const currentRef = useLatest(currentTempoPercent)
  // The tempo to give back when the practice ends, memorised at arming.
  const resumePercentRef = useRef(100)

  const start = useCallback((policy: SpeedTrainerPolicy) => {
    resumePercentRef.current = currentRef.current()
    const armed = startSpeedTrainer(policy)
    stateRef.current = armed
    setState(armed)
    applyRef.current(armed.currentPercent)
  }, [])

  const stop = useCallback(() => {
    // Restore only when a ramp was actually running: every lifecycle seam
    // (slider takeover, project open, import) calls stop defensively, and an
    // idle stop must not re-apply a stale memorised tempo. On a slider
    // takeover the caller applies the user's choice right after, which wins.
    if (stateRef.current !== undefined) {
      applyRef.current(resumePercentRef.current)
    }
    stateRef.current = undefined
    setState(undefined)
  }, [])

  const recordPass = useCallback(() => {
    const current = stateRef.current
    if (!current) {
      return
    }
    const next = recordLoopPass(current)
    stateRef.current = next
    setState(next)
    if (next.currentPercent !== current.currentPercent) {
      applyRef.current(next.currentPercent)
    }
  }, [])

  return useMemo(
    () => ({ state, start, stop, recordPass }),
    [state, start, stop, recordPass]
  )
}
