import type { LoopRegion } from '../loops/domain/loop-region.ts'
import { type Percent, percent, type Seconds } from '../shared/units.ts'
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
  /** Tempo the practice starts at (100 = full speed). */
  readonly startPercent: Percent
  /** How much the tempo climbs at each earned step, in percent points. */
  readonly incrementPercent: Percent
  /** Completed loop passes required to earn one step. */
  readonly passesPerStep: number
  /** The tempo the ramp climbs to, then holds. */
  readonly targetPercent: Percent
}

export interface SpeedTrainerState {
  readonly policy: SpeedTrainerPolicy
  /** Passes recorded since the last earned step (or since the start). */
  readonly passesInStep: number
  /** The tempo to practise at right now. */
  readonly currentPercent: Percent
}

/** The smallest meaningful climb per step, in percent points. */
const MIN_INCREMENT_PERCENT = percent(1)

/**
 * Confine a tempo percent to the playable range; `NaN` → full speed. Clamped
 * natively in percent space — a `/100 … *100` round-trip through the rate
 * grain is not an identity in IEEE754 (55 → 55.00000000000001) and would leak
 * float junk into the read-out and the spoken announcement.
 */
function clampTempoPercent(value: number): Percent {
  if (Number.isNaN(value)) {
    return percent(100)
  }
  return percent(
    Math.min(Math.max(value, MIN_TEMPO_PERCENT), MAX_TEMPO_PERCENT)
  )
}

/**
 * Arm the ramp: the practice starts at the policy's start tempo. The policy
 * is normalised on the way in — tempos confined to the playable range (an
 * emptied form field's `NaN` reads as full speed), a target below the start
 * lifted to the start (the ramp only climbs), increment and cadence floored
 * to their minimums so every pass counts toward a real step.
 */
function normalisePolicy(policy: SpeedTrainerPolicy): SpeedTrainerPolicy {
  const startPercent = clampTempoPercent(policy.startPercent)
  return {
    startPercent,
    incrementPercent: percent(
      Math.max(
        Number.isNaN(policy.incrementPercent) ? 0 : policy.incrementPercent,
        MIN_INCREMENT_PERCENT
      )
    ),
    passesPerStep: Math.max(
      Number.isNaN(policy.passesPerStep) ? 1 : Math.floor(policy.passesPerStep),
      1
    ),
    targetPercent: percent(
      Math.max(clampTempoPercent(policy.targetPercent), startPercent)
    )
  }
}

export function startSpeedTrainer(
  policy: SpeedTrainerPolicy
): SpeedTrainerState {
  const normalised = normalisePolicy(policy)
  return {
    policy: normalised,
    passesInStep: 0,
    currentPercent: normalised.startPercent
  }
}

/** A read-only summary of the ramp a policy would run, for the « Démarrer »
 * preview line — every field normalised exactly as `startSpeedTrainer` does,
 * so the preview can never promise a ramp different from the one that runs. */
export interface SpeedTrainerPreview {
  readonly startPercent: Percent
  readonly targetPercent: Percent
  readonly incrementPercent: Percent
  readonly passesPerStep: number
  /** Distinct tempo levels the ramp visits, start..target inclusive (≥ 1). */
  readonly stepCount: number
}

/**
 * Derive the preview of a policy: the normalised bounds plus how many tempo
 * levels the ramp climbs through — start, one per whole increment, and the
 * capped final level when the span is not a whole multiple (matching how
 * `recordLoopPass` tops out at the target).
 */
export function previewSpeedTrainer(
  policy: SpeedTrainerPolicy
): SpeedTrainerPreview {
  const { startPercent, targetPercent, incrementPercent, passesPerStep } =
    normalisePolicy(policy)
  const span = targetPercent - startPercent
  const wholeSteps = Math.floor(span / incrementPercent)
  const hasCappedFinal = span % incrementPercent > 0
  return {
    startPercent,
    targetPercent,
    incrementPercent,
    passesPerStep,
    stepCount: wholeSteps + 1 + (hasCappedFinal ? 1 : 0)
  }
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
    currentPercent: percent(
      Math.min(
        state.currentPercent + policy.incrementPercent,
        policy.targetPercent
      )
    )
  }
}

/**
 * The session transitions a running ramp can cross. Every place the adapter
 * mutates the loupe, the looping mode or the tempo names its seam here, so the
 * disarm decision below stays the ONE definition of when a practice ends.
 */
export type SpeedTrainerSeam =
  /** A direct tempo change (slider, restore, import reset) takes authority
   * back from the ramp. */
  | 'tempo-taken'
  /** A different passage becomes the loupe (fresh drag, recalled loop,
   * structure span). */
  | 'loupe-selected'
  /** An edge edit of the same passage (handle drag, keyboard nudge). */
  | 'loupe-adjusted'
  /** The loupe is discarded — nothing left to count passes on. */
  | 'loupe-cleared'
  /** A project open seats a persisted loupe — a ramp never outlives its
   * session. */
  | 'loupe-restored'
  /** Play-through mode: no wrap can ever fire, a « running » ramp would sit
   * dead while claiming progress. */
  | 'looping-disabled'
  /** Looping re-armed on the same passage. */
  | 'looping-enabled'

/**
 * Whether a running practice survives a session seam. The rule in one place:
 * the ramp belongs to the passage it was armed on, borrows the tempo, and
 * needs wraps to earn steps — a seam that breaks any of those three ends it.
 */
export function speedTrainerSurvives(seam: SpeedTrainerSeam): boolean {
  return seam === 'loupe-adjusted' || seam === 'looping-enabled'
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
  positionSeconds: Seconds
): boolean {
  const overshoot = positionSeconds - region.endSeconds
  return overshoot >= 0 && overshoot <= PASS_OVERSHOOT_SECONDS
}
