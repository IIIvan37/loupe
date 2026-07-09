import {
  recordLoopPass,
  type SpeedTrainerPolicy,
  type SpeedTrainerState,
  startSpeedTrainer
} from '@app/core'
import { useCallback, useRef, useState } from 'react'

export interface SpeedTrainer {
  /** The running ramp, or undefined when the trainer is off. */
  readonly state: SpeedTrainerState | undefined
  /** Arm the ramp: seats its start tempo on the player straight away. */
  readonly start: (policy: SpeedTrainerPolicy) => void
  /** Stop practising — the tempo stays where the ramp left it. */
  readonly stop: () => void
  /** One completed loop pass (wrap-around). Inert while the trainer is off. */
  readonly recordPass: () => void
}

/**
 * Smart hook owning the speed-trainer ramp (`startSpeedTrainer` /
 * `recordLoopPass`): the transport's position listener reports each loop wrap
 * through `recordPass`, and every earned step lands on the player through
 * `applyTempoPercent`. That listener is mount-once, so `recordPass` is
 * identity-stable and reads the live state from a ref.
 */
export function useSpeedTrainer(
  applyTempoPercent: (percent: number) => void
): SpeedTrainer {
  const [state, setState] = useState<SpeedTrainerState | undefined>(undefined)
  const stateRef = useRef<SpeedTrainerState | undefined>(undefined)
  const applyRef = useRef(applyTempoPercent)
  applyRef.current = applyTempoPercent

  function start(policy: SpeedTrainerPolicy): void {
    const armed = startSpeedTrainer(policy)
    stateRef.current = armed
    setState(armed)
    applyRef.current(armed.currentPercent)
  }

  function stop(): void {
    stateRef.current = undefined
    setState(undefined)
  }

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

  return { state, start, stop, recordPass }
}
