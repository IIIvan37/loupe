import type { LoopRegion } from './loop-region.ts'
import { MAX_TEMPO_PERCENT, MIN_TEMPO_PERCENT } from './playback-rate.ts'

/**
 * Speed trainer: practise a loop slow, earn speed. A pure ramp policy — the
 * player starts the loop below full speed and climbs by a fixed increment
 * every N completed passes, up to a ceiling. Tempo is expressed in percent of
 * the original speed (the transport control's grain, 100 = full speed) so the
 * ramp's integer arithmetic stays exact. Values in, values out: the web hook
 * records each loop wrap and applies `currentPercent` to the engines.
 */

export interface SpeedTrainerPolicy {
  /** Tempo the practice starts at, in percent (100 = full speed). */
  readonly startPercent: number
  /** How much the tempo climbs at each earned step, in percent points. */
  readonly incrementPercent: number
  /** Completed loop passes required to earn one step. */
  readonly passesPerStep: number
  /** The tempo the ramp climbs to, then holds, in percent. */
  readonly targetPercent: number
}

export interface SpeedTrainerState {
  readonly policy: SpeedTrainerPolicy
  /** Passes recorded since the last earned step (or since the start). */
  readonly passesInStep: number
  /** The tempo to practise at right now, in percent. */
  readonly currentPercent: number
}

/** The smallest meaningful climb per step, in percent points. */
const MIN_INCREMENT_PERCENT = 1

/**
 * Confine a tempo percent to the playable range; `NaN` → full speed. Clamped
 * natively in percent space — a `/100 … *100` round-trip through the rate
 * grain is not an identity in IEEE754 (55 → 55.00000000000001) and would leak
 * float junk into the read-out and the spoken announcement.
 */
function clampTempoPercent(percent: number): number {
  if (Number.isNaN(percent)) {
    return 100
  }
  return Math.min(Math.max(percent, MIN_TEMPO_PERCENT), MAX_TEMPO_PERCENT)
}

/**
 * Arm the ramp: the practice starts at the policy's start tempo. The policy
 * is normalised on the way in — tempos confined to the playable range (an
 * emptied form field's `NaN` reads as full speed), a target below the start
 * lifted to the start (the ramp only climbs), increment and cadence floored
 * to their minimums so every pass counts toward a real step.
 */
export function startSpeedTrainer(
  policy: SpeedTrainerPolicy
): SpeedTrainerState {
  const startPercent = clampTempoPercent(policy.startPercent)
  const normalised: SpeedTrainerPolicy = {
    startPercent,
    incrementPercent: Math.max(
      Number.isNaN(policy.incrementPercent) ? 0 : policy.incrementPercent,
      MIN_INCREMENT_PERCENT
    ),
    passesPerStep: Math.max(
      Number.isNaN(policy.passesPerStep) ? 1 : Math.floor(policy.passesPerStep),
      1
    ),
    targetPercent: Math.max(
      clampTempoPercent(policy.targetPercent),
      startPercent
    )
  }
  return { policy: normalised, passesInStep: 0, currentPercent: startPercent }
}

/**
 * One completed loop pass. Every `passesPerStep` passes the tempo climbs by
 * the increment, capped at the target; once the target is reached the state
 * is returned unchanged (the practice is at full ramp).
 */
export function recordLoopPass(state: SpeedTrainerState): SpeedTrainerState {
  const { policy } = state
  if (state.currentPercent >= policy.targetPercent) {
    return state
  }
  const passes = state.passesInStep + 1
  if (passes < policy.passesPerStep) {
    return { ...state, passesInStep: passes }
  }
  return {
    ...state,
    passesInStep: 0,
    currentPercent: Math.min(
      state.currentPercent + policy.incrementPercent,
      policy.targetPercent
    )
  }
}

/**
 * How far past the loop end a streamed position may land and still count as a
 * played-through pass. Engines tick once per animation frame, so a real pass
 * overshoots by a frame's worth of audio (tens of milliseconds, stall-tolerant
 * at half a second); a click or scrub landing further out is a repositioning,
 * not a practised repetition.
 */
const PASS_OVERSHOOT_SECONDS = 0.5

/**
 * Whether a streamed position at/after the loop end represents a COMPLETED
 * pass (played through to the end) rather than a corrective wrap after a
 * seek past the loop. The transport still wraps the playhead in both cases;
 * only the ramp's pass count is gated on this.
 */
export function completesLoopPass(
  region: LoopRegion,
  positionSeconds: number
): boolean {
  const overshoot = positionSeconds - region.endSeconds
  return overshoot >= 0 && overshoot <= PASS_OVERSHOOT_SECONDS
}
