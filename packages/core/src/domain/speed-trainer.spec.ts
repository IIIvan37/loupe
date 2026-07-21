import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { MAX_PLAYBACK_RATE, MIN_PLAYBACK_RATE } from './playback-rate.ts'
import {
  completesLoopPass,
  previewSpeedTrainer,
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

  it('keeps an in-range integer percent exact (no float round-trip)', () => {
    // 55/100*100 !== 55 in IEEE754 — the clamp must stay in percent space so
    // the read-out and the announcement never show « 55.00000000000001 % ».
    const state = startSpeedTrainer(
      policy({ startPercent: 55, targetPercent: 115 })
    )
    expect(state.currentPercent).toBe(55)
    expect(state.policy.targetPercent).toBe(115)
  })
})

describe('completesLoopPass', () => {
  const region = { startSeconds: 2, endSeconds: 6 }

  it('counts a wrap just past the loop end as a completed pass', () => {
    expect(completesLoopPass(region, 6)).toBe(true)
    expect(completesLoopPass(region, 6.4)).toBe(true)
  })

  it('does not count a position still inside the loop', () => {
    expect(completesLoopPass(region, 5.9)).toBe(false)
  })

  it('does not count a seek landing well past the end (never played through)', () => {
    // A scrub/click at 8 s wraps the playhead back, but no pass was practised.
    expect(completesLoopPass(region, 8)).toBe(false)
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

describe('previewSpeedTrainer', () => {
  it('summarises the ramp the given policy will run', () => {
    // 70 → 100 by +5 visits 70,75,80,85,90,95,100 — seven levels.
    const preview = previewSpeedTrainer(policy())
    expect(preview).toEqual({
      startPercent: 70,
      targetPercent: 100,
      incrementPercent: 5,
      passesPerStep: 4,
      stepCount: 7
    })
  })

  it('counts the capped final level when the span is not a whole multiple', () => {
    // 70 → 100 by +7 visits 70,77,84,91,98,100(capped) — six levels.
    expect(previewSpeedTrainer(policy({ incrementPercent: 7 })).stepCount).toBe(
      6
    )
  })

  it('is a single level when the ramp cannot climb', () => {
    // A target at or below the start is lifted to the start: no climb.
    expect(previewSpeedTrainer(policy({ targetPercent: 60 })).stepCount).toBe(1)
    expect(
      previewSpeedTrainer(policy({ startPercent: 100, targetPercent: 100 }))
        .stepCount
    ).toBe(1)
  })

  it('reflects the SAME normalisation as startSpeedTrainer (never lies)', () => {
    // An emptied target (NaN → full speed) and a below-floor start are
    // normalised identically to what the armed ramp will use.
    const raw = policy({ startPercent: 10, targetPercent: Number.NaN })
    const preview = previewSpeedTrainer(raw)
    const armed = startSpeedTrainer(raw)
    expect(preview.startPercent).toBe(armed.policy.startPercent)
    expect(preview.targetPercent).toBe(armed.policy.targetPercent)
    expect(preview.incrementPercent).toBe(armed.policy.incrementPercent)
    expect(preview.passesPerStep).toBe(armed.policy.passesPerStep)
  })

  // Oracle: stepCount equals the number of distinct tempo levels the real ramp
  // visits — tie the preview to `recordLoopPass` so the two never diverge.
  it('stepCount matches the levels recordLoopPass actually visits', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, min: 40, max: 150 }),
        fc.double({ noNaN: true, min: 40, max: 150 }),
        fc.double({ noNaN: true, min: 1, max: 60 }),
        (startPercent, targetPercent, incrementPercent) => {
          const p = policy({
            startPercent,
            targetPercent,
            incrementPercent,
            passesPerStep: 1
          })
          const { stepCount } = previewSpeedTrainer(p)
          let state = startSpeedTrainer(p)
          const levels = new Set<number>([state.currentPercent])
          // One pass per step (passesPerStep 1); climb until it plateaus.
          for (let i = 0; i < 1000; i += 1) {
            const next = recordLoopPass(state)
            if (next.currentPercent === state.currentPercent) {
              break
            }
            levels.add(next.currentPercent)
            state = next
          }
          expect(stepCount).toBe(levels.size)
        }
      )
    )
  })
})
