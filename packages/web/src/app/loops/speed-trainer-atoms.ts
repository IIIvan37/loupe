import type { SpeedTrainerState } from '@app/core'
import { atom } from 'jotai'

/**
 * The speed-trainer's view state (ADR 0010) — the running ramp, or undefined
 * while the trainer is off. Declared here so the loop controls read it on
 * their own; every transition stays in `useSpeedTrainer`, which calls the
 * core's use-cases.
 */
export const speedTrainerStateAtom = atom<SpeedTrainerState | undefined>(
  undefined
)
