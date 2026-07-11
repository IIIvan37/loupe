// @vitest-environment jsdom
import type { CountIn, MixerState, TempoAnalysis } from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { vi } from 'vitest'
import { METRONOME_ID } from './metronome-stem.ts'
import {
  type CountInParams,
  type CountInPlayer,
  useCountIn
} from './use-count-in.ts'

/** A steady 120 BPM grid (beats every 0.5 s), downbeats every 4. */
const analysis: TempoAnalysis = {
  bpm: 120,
  beatsPerBar: 4,
  grid: Array.from({ length: 16 }, (_, k) => ({
    timeSeconds: k * 0.5,
    downbeat: k % 4 === 0
  }))
}

/** The click lane audible (unmuted, no solo elsewhere). */
const audibleMixer: MixerState = [
  { id: 'piste', gainDb: 0, muted: false, soloed: false },
  { id: METRONOME_ID, gainDb: 0, muted: false, soloed: false }
]

interface FakePlayer extends CountInPlayer {
  readonly played: CountIn[]
  readonly cancel: ReturnType<typeof vi.fn>
  /** Fire the scheduled end of the last played count-in. */
  readonly finish: () => void
}

function fakePlayer(): FakePlayer {
  const played: CountIn[] = []
  const cancel = vi.fn()
  let onEnded: (() => void) | undefined
  return {
    played,
    cancel,
    finish: () => onEnded?.(),
    play: (countIn, ended) => {
      played.push(countIn)
      onEnded = ended
      return cancel
    }
  }
}

function params(overrides: Partial<CountInParams> = {}): CountInParams {
  return {
    canPlay: true,
    isPlaying: false,
    getPositionSeconds: () => 0,
    timeRatio: 1,
    analysis,
    metronomeEnabled: true,
    mixerState: audibleMixer,
    togglePlayback: vi.fn(),
    seekToSeconds: vi.fn(),
    ...overrides
  }
}

describe('useCountIn', () => {
  it('defers the start behind one bar of clicks when the click is audible', () => {
    const player = fakePlayer()
    const toggle = vi.fn()
    const { result } = renderHook(() =>
      useCountIn({ ...params({ togglePlayback: toggle }), player })
    )

    act(() => {
      result.current.togglePlayback()
    })

    // One bar at 120 BPM ×1: four counts, two seconds — playback not started
    // yet (the landing click will be the track's own, on the snapped beat).
    expect(toggle).not.toHaveBeenCalled()
    expect(result.current.countingIn).toBe(true)
    expect(player.played[0]?.durationSeconds).toBe(2)
    expect(player.played[0]?.beats).toHaveLength(4)
  })

  it('starts playback when the count-in ends', () => {
    const player = fakePlayer()
    const toggle = vi.fn()
    const { result } = renderHook(() =>
      useCountIn({ ...params({ togglePlayback: toggle }), player })
    )

    act(() => {
      result.current.togglePlayback()
    })
    act(() => {
      player.finish()
    })

    expect(toggle).toHaveBeenCalledOnce()
    expect(result.current.countingIn).toBe(false)
  })

  it('a second press during the count-in abandons it, still paused', () => {
    const player = fakePlayer()
    const toggle = vi.fn()
    const { result } = renderHook(() =>
      useCountIn({ ...params({ togglePlayback: toggle }), player })
    )

    act(() => {
      result.current.togglePlayback()
    })
    act(() => {
      result.current.togglePlayback()
    })

    expect(player.cancel).toHaveBeenCalledOnce()
    expect(toggle).not.toHaveBeenCalled()
    expect(result.current.countingIn).toBe(false)
  })

  it('snaps an off-beat playhead onto the grid before counting', () => {
    const player = fakePlayer()
    const seek = vi.fn()
    const { result } = renderHook(() =>
      useCountIn({
        ...params({ getPositionSeconds: () => 1.3, seekToSeconds: seek }),
        player
      })
    )

    act(() => {
      result.current.togglePlayback()
    })

    // 1.3 s sits between the 1 s and 1.5 s beats — the landing is 1.5 s.
    expect(seek).toHaveBeenCalledWith(1.5)
  })

  it('leaves the playhead alone when it already sits on a beat', () => {
    const player = fakePlayer()
    const seek = vi.fn()
    const { result } = renderHook(() =>
      useCountIn({
        ...params({ getPositionSeconds: () => 1.5, seekToSeconds: seek }),
        player
      })
    )

    act(() => {
      result.current.togglePlayback()
    })

    expect(seek).not.toHaveBeenCalled()
    expect(player.played).toHaveLength(1)
  })

  it('counts in at the tempo felt at the playhead, not the headline bpm', () => {
    const player = fakePlayer()
    // Two steady stretches: 120 BPM then 60 BPM from 8 s on.
    const variable: TempoAnalysis = {
      bpm: 120,
      beatsPerBar: 4,
      grid: [
        ...Array.from({ length: 16 }, (_, k) => ({
          timeSeconds: k * 0.5,
          downbeat: k % 4 === 0
        })),
        ...Array.from({ length: 8 }, (_, k) => ({
          timeSeconds: 8 + k,
          downbeat: k % 4 === 0
        }))
      ]
    }
    const { result } = renderHook(() =>
      useCountIn({
        ...params({ analysis: variable, getPositionSeconds: () => 10 }),
        player
      })
    )

    act(() => {
      result.current.togglePlayback()
    })

    // 60 BPM at the playhead: one bar of four beats spans four seconds.
    expect(player.played[0]?.durationSeconds).toBeCloseTo(4, 5)
  })

  it('stretches the count with the playback rate', () => {
    const player = fakePlayer()
    const { result } = renderHook(() =>
      useCountIn({ ...params({ timeRatio: 0.5 }), player })
    )

    act(() => {
      result.current.togglePlayback()
    })

    // 120 BPM heard at half speed: the bar takes twice as long.
    expect(player.played[0]?.durationSeconds).toBeCloseTo(4, 5)
  })

  it('plays straight away while the click lane is muted', () => {
    const player = fakePlayer()
    const toggle = vi.fn()
    const muted: MixerState = audibleMixer.map((channel) =>
      channel.id === METRONOME_ID ? { ...channel, muted: true } : channel
    )
    const { result } = renderHook(() =>
      useCountIn({
        ...params({ togglePlayback: toggle, mixerState: muted }),
        player
      })
    )

    act(() => {
      result.current.togglePlayback()
    })

    expect(toggle).toHaveBeenCalledOnce()
    expect(player.played).toHaveLength(0)
  })

  it('plays straight away when a solo elsewhere silences the click', () => {
    const player = fakePlayer()
    const toggle = vi.fn()
    const soloElsewhere: MixerState = audibleMixer.map((channel) =>
      channel.id === 'piste' ? { ...channel, soloed: true } : channel
    )
    const { result } = renderHook(() =>
      useCountIn({
        ...params({ togglePlayback: toggle, mixerState: soloElsewhere }),
        player
      })
    )

    act(() => {
      result.current.togglePlayback()
    })

    expect(toggle).toHaveBeenCalledOnce()
    expect(player.played).toHaveLength(0)
  })

  it('plays straight away without a metronome or a tempo', () => {
    const player = fakePlayer()
    const toggle = vi.fn()
    const { result, rerender } = renderHook(
      (props: CountInParams) => useCountIn({ ...props, player }),
      { initialProps: params({ togglePlayback: toggle, analysis: undefined }) }
    )

    act(() => {
      result.current.togglePlayback()
    })
    rerender(params({ togglePlayback: toggle, metronomeEnabled: false }))
    act(() => {
      result.current.togglePlayback()
    })

    expect(toggle).toHaveBeenCalledTimes(2)
    expect(player.played).toHaveLength(0)
  })

  it('pauses immediately — a count-in only fronts a start', () => {
    const player = fakePlayer()
    const toggle = vi.fn()
    const { result } = renderHook(() =>
      useCountIn({ ...params({ togglePlayback: toggle, isPlaying: true }), player })
    )

    act(() => {
      result.current.togglePlayback()
    })

    expect(toggle).toHaveBeenCalledOnce()
    expect(player.played).toHaveLength(0)
  })

  it('abandons a pending count-in when the tempo is replaced or reset', () => {
    const player = fakePlayer()
    const toggle = vi.fn()
    const { result, rerender } = renderHook(
      (props: CountInParams) => useCountIn({ ...props, player }),
      { initialProps: params({ togglePlayback: toggle }) }
    )

    act(() => {
      result.current.togglePlayback()
    })
    rerender(params({ togglePlayback: toggle, analysis: undefined }))

    expect(player.cancel).toHaveBeenCalledOnce()
    expect(result.current.countingIn).toBe(false)
    expect(toggle).not.toHaveBeenCalled()
  })
})
