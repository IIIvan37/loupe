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
    setGain: vi.fn()
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
    expect(result.current.transport.positionSeconds).toBe(2)
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
    expect(result.current.transport.positionSeconds).toBe(6.5)
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
    expect(stem.engine.seekTo).not.toHaveBeenCalled() // no hand-off on mount

    rerender({ stemsActive: true, loopRegion: undefined, loopEnabled: true })

    expect(pb.engine.pause).toHaveBeenCalled()
    expect(stem.engine.pause).toHaveBeenCalled()
    expect(stem.engine.seekTo).toHaveBeenCalledWith(5)
    expect(result.current.transport.isPlaying).toBe(false)
  })
})
