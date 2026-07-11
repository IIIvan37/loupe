// @vitest-environment jsdom
import type { LoopRegion, PlaybackEngine, StemPlaybackEngine } from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  type TransportEnginesParams,
  useTransportEngines
} from './use-transport-engines.ts'

const region = (start: number, end: number): LoopRegion => ({
  startSeconds: start,
  endSeconds: end
})

/** A spy engine whose streamed position the test drives via `emit`. */
function fakePlayback() {
  const listeners = new Set<(seconds: number) => void>()
  const engine: PlaybackEngine = {
    load: vi.fn(async () => {}),
    play: vi.fn(),
    pause: vi.fn(),
    seekTo: vi.fn(),
    setTimeRatio: vi.fn(),
    setPitchSemitones: vi.fn(),
    onPositionChange: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
  const emit = (s: number) => {
    for (const listener of listeners) {
      listener(s)
    }
  }
  return { engine, emit }
}

function fakeStemPlayback() {
  const base = fakePlayback()
  const engine: StemPlaybackEngine = {
    ...base.engine,
    // The stem engine's `load` takes stems, not a single track — override the
    // spread `PlaybackEngine.load` so the literal matches `StemPlaybackEngine`.
    load: vi.fn(async () => {}),
    addStem: vi.fn(async () => {}),
    removeStem: vi.fn(),
    setGain: vi.fn(),
    stemAudio: () => undefined
  }
  return { engine, emit: base.emit }
}

type Props = Omit<TransportEnginesParams, 'playback' | 'stemPlayback'>

function mount(
  playback: PlaybackEngine,
  stemPlayback: StemPlaybackEngine,
  initial: Props
) {
  return renderHook(
    (props: Props) => useTransportEngines({ playback, stemPlayback, ...props }),
    { initialProps: initial }
  )
}

describe('useTransportEngines', () => {
  it('wraps playback to the loop start when the position passes the loop end', () => {
    const pb = fakePlayback()
    const stem = fakeStemPlayback()
    const { result } = mount(pb.engine, stem.engine, {
      stemsActive: false,
      loopRegion: region(2, 6),
      loopEnabled: true
    })
    act(() => result.current.dispatch({ type: 'load', durationSeconds: 10 }))

    act(() => pb.emit(6.5))

    expect(pb.engine.seekTo).toHaveBeenCalledWith(2)
    expect(result.current.position.get()).toBe(2)
  })

  it('a frame tick never produces a new transport state', () => {
    // THE Lot L.1 invariant: the engine streams its position at animation-frame
    // rate; routing it through React state re-rendered the whole workstation
    // 60-120 times a second. Ticks land in the position store only.
    const pb = fakePlayback()
    const stem = fakeStemPlayback()
    const { result } = mount(pb.engine, stem.engine, {
      stemsActive: false,
      loopRegion: undefined,
      loopEnabled: true
    })
    act(() => result.current.dispatch({ type: 'load', durationSeconds: 10 }))
    const before = result.current.transport

    act(() => pb.emit(3))

    expect(result.current.transport).toBe(before)
  })

  it('streams the ticked position through the store', () => {
    const pb = fakePlayback()
    const stem = fakeStemPlayback()
    const { result } = mount(pb.engine, stem.engine, {
      stemsActive: false,
      loopRegion: undefined,
      loopEnabled: true
    })
    act(() => result.current.dispatch({ type: 'load', durationSeconds: 10 }))

    act(() => pb.emit(3.25))

    expect(result.current.position.get()).toBe(3.25)
  })

  it('stops playback when the position reaches the end of the timeline', () => {
    const pb = fakePlayback()
    const stem = fakeStemPlayback()
    const { result } = mount(pb.engine, stem.engine, {
      stemsActive: false,
      loopRegion: undefined,
      loopEnabled: true
    })
    act(() => {
      result.current.dispatch({ type: 'load', durationSeconds: 10 })
      result.current.dispatch({ type: 'play' })
    })

    act(() => pb.emit(10))

    expect(result.current.transport.isPlaying).toBe(false)
  })

  it('plays straight through when looping is disarmed', () => {
    const pb = fakePlayback()
    const stem = fakeStemPlayback()
    const { result } = mount(pb.engine, stem.engine, {
      stemsActive: false,
      loopRegion: region(2, 6),
      loopEnabled: false
    })
    act(() => result.current.dispatch({ type: 'load', durationSeconds: 10 }))

    act(() => pb.emit(6.5))

    expect(pb.engine.seekTo).not.toHaveBeenCalled()
    expect(result.current.position.get()).toBe(6.5)
  })

  it('wraps on the stem engine once the mix drives the transport', () => {
    const pb = fakePlayback()
    const stem = fakeStemPlayback()
    const { result, rerender } = mount(pb.engine, stem.engine, {
      stemsActive: false,
      loopRegion: region(2, 6),
      loopEnabled: true
    })
    act(() => result.current.dispatch({ type: 'load', durationSeconds: 10 }))
    rerender({ stemsActive: true, loopRegion: region(2, 6), loopEnabled: true })

    act(() => stem.emit(6.5))

    expect(stem.engine.seekTo).toHaveBeenCalledWith(2)
    expect(pb.engine.seekTo).not.toHaveBeenCalled()
  })

  it('notifies each completed loop pass, and only those', () => {
    const pb = fakePlayback()
    const stem = fakeStemPlayback()
    const onLoopWrap = vi.fn()
    const { result } = mount(pb.engine, stem.engine, {
      stemsActive: false,
      loopRegion: region(2, 6),
      loopEnabled: true,
      onLoopWrap
    })
    act(() => result.current.dispatch({ type: 'load', durationSeconds: 10 }))

    // Ordinary ticks inside the loop are not passes.
    act(() => pb.emit(3))
    act(() => pb.emit(5))
    expect(onLoopWrap).not.toHaveBeenCalled()

    act(() => pb.emit(6.5))
    expect(onLoopWrap).toHaveBeenCalledTimes(1)
    act(() => pb.emit(6.1))
    expect(onLoopWrap).toHaveBeenCalledTimes(2)
  })

  it('pulls a playhead left outside the loop up to its start, earning nothing', () => {
    const pb = fakePlayback()
    const stem = fakeStemPlayback()
    const onLoopWrap = vi.fn()
    const { result } = mount(pb.engine, stem.engine, {
      stemsActive: false,
      loopRegion: region(2, 6),
      loopEnabled: true,
      onLoopWrap
    })
    act(() => result.current.dispatch({ type: 'load', durationSeconds: 10 }))

    // The cursor sits before the enabled loop (fresh arm, or a click there):
    // it is repositioned at the loop start — no practice pass was completed.
    act(() => pb.emit(1))

    expect(pb.engine.seekTo).toHaveBeenCalledWith(2)
    expect(result.current.position.get()).toBe(2)
    expect(onLoopWrap).not.toHaveBeenCalled()
  })

  it('wraps a seek far past the loop end without counting a pass', () => {
    const pb = fakePlayback()
    const stem = fakeStemPlayback()
    const onLoopWrap = vi.fn()
    const { result } = mount(pb.engine, stem.engine, {
      stemsActive: false,
      loopRegion: region(2, 6),
      loopEnabled: true,
      onLoopWrap
    })
    act(() => result.current.dispatch({ type: 'load', durationSeconds: 10 }))

    // A click/scrub at 8 s: the playhead snaps back, but nothing was practised.
    act(() => pb.emit(8))

    expect(pb.engine.seekTo).toHaveBeenCalledWith(2)
    expect(onLoopWrap).not.toHaveBeenCalled()
  })

  it('does not notify a pass when looping is disarmed', () => {
    const pb = fakePlayback()
    const stem = fakeStemPlayback()
    const onLoopWrap = vi.fn()
    const { result } = mount(pb.engine, stem.engine, {
      stemsActive: false,
      loopRegion: region(2, 6),
      loopEnabled: false,
      onLoopWrap
    })
    act(() => result.current.dispatch({ type: 'load', durationSeconds: 10 }))

    act(() => pb.emit(6.5))

    expect(onLoopWrap).not.toHaveBeenCalled()
  })

  it('hands the playhead to the stem mix on a real switch, not on mount', () => {
    const pb = fakePlayback()
    const stem = fakeStemPlayback()
    const { result, rerender } = mount(pb.engine, stem.engine, {
      stemsActive: false,
      loopRegion: undefined,
      loopEnabled: true
    })
    // Move the playhead, then hand off to the mix.
    act(() => {
      result.current.dispatch({ type: 'load', durationSeconds: 10 })
      result.current.dispatch({ type: 'seek', toSeconds: 5 })
    })
    // No hand-off on mount: with stems inactive a spurious mount hand-off would
    // pause + seek the TRACK engine (the else branch), so assert on that — not on
    // the stem engine, which a mount hand-off would never touch here.
    expect(pb.engine.pause).not.toHaveBeenCalled()
    expect(pb.engine.seekTo).not.toHaveBeenCalled()

    rerender({ stemsActive: true, loopRegion: undefined, loopEnabled: true })

    expect(pb.engine.pause).toHaveBeenCalled()
    expect(stem.engine.pause).toHaveBeenCalled()
    expect(stem.engine.seekTo).toHaveBeenCalledWith(5)
    expect(result.current.transport.isPlaying).toBe(false)
  })
})
