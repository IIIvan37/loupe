import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  initialTransport,
  type TransportState,
  transportReducer
} from './transport.ts'

const loaded: TransportState = {
  positionSeconds: 0,
  durationSeconds: 10,
  isPlaying: false
}

describe('transportReducer', () => {
  it('starts stopped at the origin with no duration', () => {
    expect(initialTransport).toEqual({
      positionSeconds: 0,
      durationSeconds: 0,
      isPlaying: false
    })
  })

  it('load sets the duration and resets to a stopped origin', () => {
    const playing: TransportState = {
      positionSeconds: 5,
      durationSeconds: 10,
      isPlaying: true
    }
    expect(
      transportReducer(playing, { type: 'load', durationSeconds: 42 })
    ).toEqual({
      positionSeconds: 0,
      durationSeconds: 42,
      isPlaying: false
    })
  })

  it('load floors a negative duration to zero', () => {
    expect(
      transportReducer(initialTransport, { type: 'load', durationSeconds: -3 })
        .durationSeconds
    ).toBe(0)
  })

  it('play and pause set the playing flag', () => {
    expect(transportReducer(loaded, { type: 'play' }).isPlaying).toBe(true)
    expect(
      transportReducer({ ...loaded, isPlaying: true }, { type: 'pause' })
        .isPlaying
    ).toBe(false)
  })

  it('pause leaves an already-stopped transport stopped (not a toggle)', () => {
    expect(transportReducer(loaded, { type: 'pause' }).isPlaying).toBe(false)
  })

  it('seek moves the position, clamped to the timeline', () => {
    expect(
      transportReducer(loaded, { type: 'seek', toSeconds: 4 }).positionSeconds
    ).toBe(4)
    expect(
      transportReducer(loaded, { type: 'seek', toSeconds: 99 }).positionSeconds
    ).toBe(10)
    expect(
      transportReducer(loaded, { type: 'seek', toSeconds: -5 }).positionSeconds
    ).toBe(0)
  })

  it('seek leaves the playing flag untouched', () => {
    const playing = { ...loaded, isPlaying: true }
    expect(
      transportReducer(playing, { type: 'seek', toSeconds: 3 }).isPlaying
    ).toBe(true)
  })

  // Property: position is always within [0, duration], whatever the action.
  it('keeps the position inside the timeline', () => {
    const action = fc.oneof(
      fc.record({ type: fc.constant('play' as const) }),
      fc.record({ type: fc.constant('pause' as const) }),
      fc.record({
        type: fc.constant('seek' as const),
        toSeconds: fc.double({ noNaN: true })
      })
    )
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 600, noNaN: true }),
        action,
        (duration, act) => {
          const state = transportReducer(initialTransport, {
            type: 'load',
            durationSeconds: duration
          })
          const next = transportReducer(state, act)
          expect(next.positionSeconds).toBeGreaterThanOrEqual(0)
          expect(next.positionSeconds).toBeLessThanOrEqual(
            state.durationSeconds
          )
        }
      )
    )
  })
})
