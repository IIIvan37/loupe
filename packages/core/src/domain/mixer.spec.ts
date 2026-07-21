import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  clampGainDb,
  dbToAmplitude,
  effectiveGains,
  emptyMixer,
  GAIN_DB_FINE_STEP,
  MAX_GAIN_DB,
  MIN_GAIN_DB,
  type MixerState,
  mixerReducer,
  stepGainDb,
  UNITY_GAIN_DB
} from './mixer.ts'

/** A channel arbitrary spanning the full fader range and both flags. */
const channelArb = fc.record({
  id: fc.string({ minLength: 1 }),
  gainDb: fc.double({ min: MIN_GAIN_DB, max: MAX_GAIN_DB, noNaN: true }),
  muted: fc.boolean(),
  soloed: fc.boolean()
})

/** A mixer state with unique channel ids (the invariant the reducer keeps). */
const stateArb: fc.Arbitrary<MixerState> = fc.uniqueArray(channelArb, {
  selector: (channel) => channel.id
})

describe('clampGainDb', () => {
  it('passes a level inside the range through unchanged', () => {
    expect(clampGainDb(-12)).toBe(-12)
    expect(clampGainDb(UNITY_GAIN_DB)).toBe(0)
  })

  it('clamps to the fader range', () => {
    expect(clampGainDb(99)).toBe(MAX_GAIN_DB)
    expect(clampGainDb(-200)).toBe(MIN_GAIN_DB)
  })

  it('falls back to unity for NaN', () => {
    expect(clampGainDb(Number.NaN)).toBe(UNITY_GAIN_DB)
  })

  it('always returns a level within the range', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true }), (db) => {
        const clamped = clampGainDb(db)
        expect(clamped).toBeGreaterThanOrEqual(MIN_GAIN_DB)
        expect(clamped).toBeLessThanOrEqual(MAX_GAIN_DB)
      })
    )
  })
})

describe('stepGainDb', () => {
  it('nudges the level by one fine step in each direction', () => {
    expect(stepGainDb(-6, 1)).toBe(-6 + GAIN_DB_FINE_STEP)
    expect(stepGainDb(-6, -1)).toBe(-6 - GAIN_DB_FINE_STEP)
  })

  it('snaps a fractional level onto the fine-step grid first', () => {
    // 3.2 dB rounds to the 0.5 grid (3.0), then a step up lands on 3.5.
    expect(stepGainDb(3.2, 1)).toBe(3.5)
    expect(stepGainDb(3.2, -1)).toBe(2.5)
  })

  it('clamps to the fader range at both ends', () => {
    expect(stepGainDb(MAX_GAIN_DB, 1)).toBe(MAX_GAIN_DB)
    expect(stepGainDb(MIN_GAIN_DB, -1)).toBe(MIN_GAIN_DB)
  })

  it('always lands within the range, on the 0.5 dB grid', () => {
    fc.assert(
      fc.property(
        fc.double({ min: MIN_GAIN_DB, max: MAX_GAIN_DB, noNaN: true }),
        fc.constantFrom<-1 | 1>(-1, 1),
        (db, direction) => {
          const next = stepGainDb(db, direction)
          expect(next).toBeGreaterThanOrEqual(MIN_GAIN_DB)
          expect(next).toBeLessThanOrEqual(MAX_GAIN_DB)
          // A multiple of the fine step (guard against float drift).
          expect(Math.round(next / GAIN_DB_FINE_STEP)).toBeCloseTo(
            next / GAIN_DB_FINE_STEP
          )
        }
      )
    )
  })
})

describe('dbToAmplitude', () => {
  it('maps unity gain to a multiplier of 1', () => {
    expect(dbToAmplitude(UNITY_GAIN_DB)).toBeCloseTo(1)
  })

  it('maps a +6 dB boost to roughly double', () => {
    expect(dbToAmplitude(6)).toBeCloseTo(1.995, 2)
  })

  it('treats the bottom of the fader as true silence', () => {
    expect(dbToAmplitude(MIN_GAIN_DB)).toBe(0)
    expect(dbToAmplitude(MIN_GAIN_DB - 10)).toBe(0)
  })

  it('is non-negative and non-decreasing in the level', () => {
    fc.assert(
      fc.property(
        fc.double({ min: MIN_GAIN_DB, max: MAX_GAIN_DB, noNaN: true }),
        fc.double({ min: MIN_GAIN_DB, max: MAX_GAIN_DB, noNaN: true }),
        (a, b) => {
          const lo = Math.min(a, b)
          const hi = Math.max(a, b)
          expect(dbToAmplitude(lo)).toBeGreaterThanOrEqual(0)
          expect(dbToAmplitude(hi)).toBeGreaterThanOrEqual(dbToAmplitude(lo))
        }
      )
    )
  })
})

describe('mixerReducer', () => {
  it('initialises one unity, unmuted, unsoloed channel per id', () => {
    const state = mixerReducer(emptyMixer, {
      type: 'init',
      ids: ['voix', 'basse']
    })
    expect(state).toEqual([
      { id: 'voix', gainDb: UNITY_GAIN_DB, muted: false, soloed: false },
      { id: 'basse', gainDb: UNITY_GAIN_DB, muted: false, soloed: false }
    ])
  })

  it('sets and clamps one channel gain, leaving the others alone', () => {
    const start = mixerReducer(emptyMixer, { type: 'init', ids: ['a', 'b'] })
    const next = mixerReducer(start, { type: 'setGain', id: 'a', gainDb: -120 })
    expect(next[0]).toMatchObject({ id: 'a', gainDb: MIN_GAIN_DB })
    expect(next[1]).toEqual(start[1])
  })

  it('toggles mute and solo on the targeted channel only', () => {
    const start = mixerReducer(emptyMixer, { type: 'init', ids: ['a', 'b'] })
    const muted = mixerReducer(start, { type: 'toggleMute', id: 'a' })
    expect(muted[0]?.muted).toBe(true)
    expect(muted[1]?.muted).toBe(false)
    const soloed = mixerReducer(muted, { type: 'toggleSolo', id: 'b' })
    expect(soloed[1]?.soloed).toBe(true)
    expect(soloed[0]?.soloed).toBe(false)
  })

  it('resets to the empty mixer', () => {
    const start = mixerReducer(emptyMixer, { type: 'init', ids: ['a'] })
    expect(mixerReducer(start, { type: 'reset' })).toEqual(emptyMixer)
  })

  it('restores a persisted state as-is, replacing the current channels', () => {
    const start = mixerReducer(emptyMixer, { type: 'init', ids: ['x'] })
    const saved: MixerState = [
      { id: 'voix', gainDb: -12, muted: true, soloed: false },
      { id: 'basse', gainDb: 3, muted: false, soloed: true }
    ]
    expect(mixerReducer(start, { type: 'restore', channels: saved })).toEqual(
      saved
    )
  })

  it('clamps each restored channel gain to the fader range', () => {
    const saved: MixerState = [
      { id: 'a', gainDb: 99, muted: false, soloed: false },
      { id: 'b', gainDb: -200, muted: false, soloed: false },
      { id: 'c', gainDb: Number.NaN, muted: false, soloed: false }
    ]
    const state = mixerReducer(emptyMixer, { type: 'restore', channels: saved })
    expect(state.map((channel) => channel.gainDb)).toEqual([
      MAX_GAIN_DB,
      MIN_GAIN_DB,
      UNITY_GAIN_DB
    ])
  })

  it('ignores actions targeting an unknown channel', () => {
    const start = mixerReducer(emptyMixer, { type: 'init', ids: ['a'] })
    expect(
      mixerReducer(start, { type: 'setGain', id: 'x', gainDb: 3 })
    ).toEqual(start)
  })

  it('appends a new unity channel with addChannel', () => {
    const start = mixerReducer(emptyMixer, { type: 'init', ids: ['a'] })
    expect(mixerReducer(start, { type: 'addChannel', id: 'metro' })).toEqual([
      { id: 'a', gainDb: UNITY_GAIN_DB, muted: false, soloed: false },
      { id: 'metro', gainDb: UNITY_GAIN_DB, muted: false, soloed: false }
    ])
  })

  it('leaves the state unchanged when addChannel targets an existing id', () => {
    const start = mixerReducer(emptyMixer, { type: 'init', ids: ['a'] })
    expect(mixerReducer(start, { type: 'addChannel', id: 'a' })).toEqual(start)
  })

  it('drops the named channel with removeChannel', () => {
    const start = mixerReducer(emptyMixer, {
      type: 'init',
      ids: ['a', 'metro']
    })
    expect(mixerReducer(start, { type: 'removeChannel', id: 'metro' })).toEqual(
      [{ id: 'a', gainDb: UNITY_GAIN_DB, muted: false, soloed: false }]
    )
  })

  it('preserves the other channels when one is removed', () => {
    const start: MixerState = [
      { id: 'a', gainDb: -12, muted: true, soloed: false },
      { id: 'metro', gainDb: 0, muted: false, soloed: false }
    ]
    expect(mixerReducer(start, { type: 'removeChannel', id: 'metro' })).toEqual(
      [{ id: 'a', gainDb: -12, muted: true, soloed: false }]
    )
  })
})

describe('effectiveGains', () => {
  it('returns the dB-derived gain when nothing is muted or soloed', () => {
    const state: MixerState = [
      { id: 'a', gainDb: 0, muted: false, soloed: false },
      { id: 'b', gainDb: 6, muted: false, soloed: false }
    ]
    const gains = effectiveGains(state)
    expect(gains[0]?.gain).toBeCloseTo(1)
    expect(gains[1]?.gain).toBeCloseTo(dbToAmplitude(6))
  })

  it('silences a muted channel', () => {
    const state: MixerState = [
      { id: 'a', gainDb: 0, muted: true, soloed: false }
    ]
    expect(effectiveGains(state)[0]?.gain).toBe(0)
  })

  it('silences every non-soloed channel when one is soloed', () => {
    const state: MixerState = [
      { id: 'a', gainDb: 0, muted: false, soloed: true },
      { id: 'b', gainDb: 0, muted: false, soloed: false }
    ]
    const gains = effectiveGains(state)
    expect(gains[0]?.gain).toBeCloseTo(1)
    expect(gains[1]?.gain).toBe(0)
  })

  it('mutes a channel even if it is soloed (mute wins)', () => {
    const state: MixerState = [
      { id: 'a', gainDb: 0, muted: true, soloed: true }
    ]
    expect(effectiveGains(state)[0]?.gain).toBe(0)
  })

  // Property: an effective gain is never negative and never exceeds the
  // channel's own fader gain — solo/mute only ever attenuate.
  it('never produces a gain above the channel fader and never negative', () => {
    fc.assert(
      fc.property(stateArb, (state) => {
        const gains = effectiveGains(state)
        expect(gains).toHaveLength(state.length)
        gains.forEach((gain, index) => {
          const channel = state[index]
          if (!channel) {
            return
          }
          expect(gain.id).toBe(channel.id)
          expect(gain.gain).toBeGreaterThanOrEqual(0)
          expect(gain.gain).toBeLessThanOrEqual(dbToAmplitude(channel.gainDb))
        })
      })
    )
  })

  // Property: with no solo active, a channel is audible iff it is not muted.
  it('audibility without solo depends only on mute', () => {
    fc.assert(
      fc.property(
        stateArb.filter((state) => !state.some((channel) => channel.soloed)),
        (state) => {
          effectiveGains(state).forEach((gain, index) => {
            const channel = state[index]
            if (!channel) {
              return
            }
            const expected = channel.muted ? 0 : dbToAmplitude(channel.gainDb)
            expect(gain.gain).toBeCloseTo(expected)
          })
        }
      )
    )
  })

  // Property: when any channel is soloed, audible ⇒ soloed and not muted.
  it('only soloed, unmuted channels are audible once a solo is active', () => {
    fc.assert(
      fc.property(
        stateArb.filter((state) => state.some((channel) => channel.soloed)),
        (state) => {
          effectiveGains(state).forEach((gain, index) => {
            const channel = state[index]
            if (!channel) {
              return
            }
            if (gain.gain > 0) {
              expect(channel.soloed).toBe(true)
              expect(channel.muted).toBe(false)
            }
          })
        }
      )
    )
  })
})
