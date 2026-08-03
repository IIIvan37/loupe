import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { loopContains } from '../loops/domain/loop-region.ts'
import { seconds } from '../shared/units.ts'
import { type PlaybackTickInput, resolvePlaybackTick } from './playback-tick.ts'

const tick = (overrides: Partial<PlaybackTickInput>): PlaybackTickInput => ({
  atSeconds: seconds(0),
  loop: undefined,
  loopEnabled: false,
  isPlaying: true,
  durationSeconds: 10,
  ...overrides
})

describe('resolvePlaybackTick', () => {
  it('advances inside the timeline', () => {
    expect(resolvePlaybackTick(tick({ atSeconds: seconds(6) }))).toEqual({
      kind: 'advance',
      endReached: false
    })
  })

  it('reaching the end of a real timeline while playing stops playback', () => {
    expect(resolvePlaybackTick(tick({ atSeconds: seconds(10) }))).toEqual({
      kind: 'advance',
      endReached: true
    })
  })

  it('never reads the end on an empty (zero-duration) timeline', () => {
    expect(
      resolvePlaybackTick(tick({ atSeconds: seconds(0), durationSeconds: 0 }))
    ).toEqual({ kind: 'advance', endReached: false })
  })

  it('does not re-stop a transport already paused at the end', () => {
    expect(
      resolvePlaybackTick(tick({ atSeconds: seconds(10), isPlaying: false }))
    ).toEqual({ kind: 'advance', endReached: false })
  })

  const loop = { startSeconds: 2, endSeconds: 6 }

  it('wraps an enabled loop back to its start at the loop end', () => {
    expect(
      resolvePlaybackTick(
        tick({ atSeconds: seconds(6.1), loop, loopEnabled: true })
      )
    ).toEqual({ kind: 'wrap', toSeconds: 2, completesPass: true })
  })

  it('wraps a seek landing far past the end without earning a pass', () => {
    // The playhead is confined either way; only the ramp's count is gated.
    expect(
      resolvePlaybackTick(
        tick({ atSeconds: seconds(9), loop, loopEnabled: true })
      )
    ).toEqual({ kind: 'wrap', toSeconds: 2, completesPass: false })
  })

  it('pulls a position left before the loop up to its start, earning nothing', () => {
    expect(
      resolvePlaybackTick(
        tick({ atSeconds: seconds(1), loop, loopEnabled: true })
      )
    ).toEqual({ kind: 'wrap', toSeconds: 2, completesPass: false })
  })

  it('plays straight through a disabled loop', () => {
    expect(
      resolvePlaybackTick(
        tick({ atSeconds: seconds(7), loop, loopEnabled: false })
      )
    ).toEqual({ kind: 'advance', endReached: false })
  })

  it('ignores a degenerate zero-length loop (would wrap-seek every frame)', () => {
    const degenerate = { startSeconds: 3, endSeconds: 3 }
    expect(
      resolvePlaybackTick(
        tick({ atSeconds: seconds(5), loop: degenerate, loopEnabled: true })
      )
    ).toEqual({ kind: 'advance', endReached: false })
  })

  it('advances inside an enabled loop', () => {
    expect(
      resolvePlaybackTick(
        tick({ atSeconds: seconds(4), loop, loopEnabled: true })
      )
    ).toEqual({ kind: 'advance', endReached: false })
  })

  // Property: with an enabled, non-degenerate loop the outcome is a wrap
  // exactly when the position falls outside the loop's half-open span.
  it('wraps exactly when an armed loop does not contain the position', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }).map(seconds),
        (a, b, atSeconds) => {
          fc.pre(a !== b)
          const region = {
            startSeconds: Math.min(a, b),
            endSeconds: Math.max(a, b)
          }
          const outcome = resolvePlaybackTick(
            tick({ atSeconds, loop: region, loopEnabled: true })
          )
          expect(outcome.kind).toBe(
            loopContains(region, atSeconds) ? 'advance' : 'wrap'
          )
        }
      )
    )
  })
})
