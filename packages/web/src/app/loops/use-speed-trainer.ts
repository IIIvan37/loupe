import {
  type Percent,
  percent,
  recordLoopPass,
  type SpeedTrainerPolicy,
  type SpeedTrainerSeam,
  type SpeedTrainerState,
  speedTrainerSurvives,
  startSpeedTrainer
} from '@app/core'
import { useAtom } from 'jotai'
import { useCallback, useMemo, useRef } from 'react'
import { useLatest } from '../../lib/use-latest.ts'
import { speedTrainerStateAtom } from './speed-trainer-atoms.ts'

export interface SpeedTrainer {
  /** The running ramp, or undefined when the trainer is off. */
  readonly state: SpeedTrainerState | undefined
  /** Arm the ramp: memorises the current tempo, then seats the start tempo. */
  readonly start: (policy: SpeedTrainerPolicy) => void
  /** Stop practising — restores the tempo memorised at arming. */
  readonly stop: () => void
  /**
   * The session crossed a seam (loupe change, looping toggle, tempo takeover):
   * consult the core's single disarm rule and stop when the ramp does not
   * survive it. Every lifecycle site names its seam instead of deciding.
   */
  readonly cross: (seam: SpeedTrainerSeam) => void
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
/** The tempo restored when a practice ends with nothing memorised. */
const FULL_SPEED = percent(100)

export function useSpeedTrainer(
  applyTempoPercent: (value: Percent) => void,
  currentTempoPercent: () => Percent
): SpeedTrainer {
  const [state, setState] = useAtom(speedTrainerStateAtom)
  const stateRef = useRef<SpeedTrainerState | undefined>(undefined)
  const applyRef = useLatest(applyTempoPercent)
  const currentRef = useLatest(currentTempoPercent)
  // The tempo to give back when the practice ends, memorised at arming.
  const resumePercentRef = useRef(FULL_SPEED)

  const start = useCallback(
    (policy: SpeedTrainerPolicy) => {
      resumePercentRef.current = currentRef.current()
      const armed = startSpeedTrainer(policy)
      stateRef.current = armed
      setState(armed)
      applyRef.current(armed.currentPercent)
    },
    [setState]
  )

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
  }, [setState])

  const cross = useCallback(
    (seam: SpeedTrainerSeam) => {
      if (!speedTrainerSurvives(seam)) {
        stop()
      }
    },
    [stop]
  )

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
  }, [setState])

  return useMemo(
    () => ({ state, start, stop, cross, recordPass }),
    [state, start, stop, cross, recordPass]
  )
}
