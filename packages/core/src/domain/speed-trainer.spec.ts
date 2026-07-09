import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { MAX_PLAYBACK_RATE, MIN_PLAYBACK_RATE } from './playback-rate.ts'
import {
  recordLoopPass,
  type SpeedTrainerPolicy,
  startSpeedTrainer
} from './speed-trainer.ts'

const policy = (
  overrides: Partial<SpeedTrainerPolicy> = {}
): SpeedTrainerPolicy => ({
  startPercent: 70,
  incrementPercent: 5,
  passesPerStep: 4,
  targetPercent: 100,
  ...overrides
})

describe('startSpeedTrainer', () => {
  it('seats the ramp at its start tempo with no pass recorded', () => {
    const state = startSpeedTrainer(policy())
    expect(state.currentPercent).toBe(70)
    expect(state.passesInStep).toBe(0)
  })
})

describe('recordLoopPass', () => {
  it('counts a pass without stepping before the cadence is met', () => {
    const state = recordLoopPass(startSpeedTrainer(policy()))
    expect(state.passesInStep).toBe(1)
    expect(state.currentPercent).toBe(70)
  })

  it('earns a step after N passes and resets the count', () => {
    let state = startSpeedTrainer(policy({ passesPerStep: 2 }))
    state = recordLoopPass(state)
    state = recordLoopPass(state)
    expect(state.currentPercent).toBe(75)
    expect(state.passesInStep).toBe(0)
  })

  it('caps a partial last step at the target tempo', () => {
    let state = startSpeedTrainer(
      policy({ startPercent: 90, incrementPercent: 8, passesPerStep: 1 })
    )
    state = recordLoopPass(state)
    expect(state.currentPercent).toBe(98)
    state = recordLoopPass(state)
    expect(state.currentPercent).toBe(100)
  })

  it('changes nothing once the target is reached', () => {
    const state = startSpeedTrainer(
      policy({ startPercent: 100, targetPercent: 100, passesPerStep: 1 })
    )
    const after = recordLoopPass(state)
    expect(after).toBe(state)
  })
})

describe('policy normalisation', () => {
  it('clamps the start and target to the playable tempo range', () => {
    const state = startSpeedTrainer(
      policy({ startPercent: 5, targetPercent: 500 })
    )
    expect(state.currentPercent).toBe(MIN_PLAYBACK_RATE * 100)
    expect(state.policy.targetPercent).toBe(MAX_PLAYBACK_RATE * 100)
  })

  it('lifts a target below the start up to the start (no downward ramp)', () => {
    const state = startSpeedTrainer(
      policy({ startPercent: 90, targetPercent: 60 })
    )
    expect(state.policy.targetPercent).toBe(90)
  })

  it('floors a broken increment and cadence to their minimums', () => {
    const state = startSpeedTrainer(
      policy({ incrementPercent: 0, passesPerStep: 0 })
    )
    expect(state.policy.incrementPercent).toBe(1)
    expect(state.policy.passesPerStep).toBe(1)
  })

  it('falls back to full speed for NaN tempos (an emptied form field)', () => {
    const state = startSpeedTrainer(
      policy({
        startPercent: Number.NaN,
        targetPercent: Number.NaN,
        incrementPercent: Number.NaN,
        passesPerStep: Number.NaN
      })
    )
    expect(state.currentPercent).toBe(100)
    expect(state.policy.targetPercent).toBe(100)
    expect(state.policy.incrementPercent).toBe(1)
    expect(state.policy.passesPerStep).toBe(1)
  })

  it('rounds a fractional cadence down to whole passes', () => {
    const state = startSpeedTrainer(policy({ passesPerStep: 2.7 }))
    expect(state.policy.passesPerStep).toBe(2)
  })
})

// Property: after k passes the tempo is exactly the earned ramp — start plus
// one increment per completed cadence, never past the target, never outside
// the playable range, and never moving down.
it('always sits at the earned ramp position, capped at the target', () => {
  fc.assert(
    fc.property(
      fc.record({
        startPercent: fc.integer({ min: 10, max: 200 }),
        incrementPercent: fc.integer({ min: 1, max: 30 }),
        passesPerStep: fc.integer({ min: 1, max: 8 }),
        targetPercent: fc.integer({ min: 10, max: 200 })
      }),
      fc.integer({ min: 0, max: 60 }),
      (raw, passes) => {
        let state = startSpeedTrainer(raw)
        const { startPercent, incrementPercent, passesPerStep, targetPercent } =
          state.policy
        let previous = state.currentPercent
        for (let i = 0; i < passes; i += 1) {
          state = recordLoopPass(state)
          expect(state.currentPercent).toBeGreaterThanOrEqual(previous)
          previous = state.currentPercent
        }
        const earned = Math.floor(passes / passesPerStep)
        expect(state.currentPercent).toBe(
          Math.min(startPercent + earned * incrementPercent, targetPercent)
        )
        expect(state.currentPercent).toBeGreaterThanOrEqual(
          MIN_PLAYBACK_RATE * 100
        )
        expect(state.currentPercent).toBeLessThanOrEqual(
          MAX_PLAYBACK_RATE * 100
        )
      }
    )
  )
})
