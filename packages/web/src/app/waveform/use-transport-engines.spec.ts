// @vitest-environment jsdom
import type {
  DecodedAudio,
  LoopRegion,
  PlaybackEngine,
  StemPlaybackEngine
} from '@app/core'
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
    unload: vi.fn(),
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

type Props = Omit<
  TransportEnginesParams,
  'playback' | 'stemPlayback' | 'trackAudio'
>

function mount(
  playback: PlaybackEngine,
  stemPlayback: StemPlaybackEngine,
  initial: Props,
  trackAudio: () => DecodedAudio | undefined = () => undefined
) {
  return renderHook(
    (props: Props) =>
      useTransportEngines({ playback, stemPlayback, trackAudio, ...props }),
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

describe('useTransportEngines — track engine unload across the hand-off (V.2)', () => {
  const audio: DecodedAudio = { sampleRate: 8, channels: [[0, 1, -1, 0]] }
  const props = (stemsActive: boolean): Props => ({
    stemsActive,
    loopRegion: undefined,
    loopEnabled: false
  })

  /** Mount at the track, move the playhead to 5 s, then hand off to the mix. */
  function handOff(
    pb: ReturnType<typeof fakePlayback>,
    stem: ReturnType<typeof fakeStemPlayback>,
    trackAudio: () => DecodedAudio | undefined = () => audio
  ) {
    const view = mount(pb.engine, stem.engine, props(false), trackAudio)
    act(() => {
      view.result.current.dispatch({ type: 'load', durationSeconds: 10 })
      view.result.current.dispatch({ type: 'seek', toSeconds: 5 })
    })
    view.rerender(props(true))
    return view
  }

  it('releases the track engine audio when the mix takes over', () => {
    const pb = fakePlayback()
    handOff(pb, fakeStemPlayback())

    expect(pb.engine.unload).toHaveBeenCalledTimes(1)
  })

  it('does not release anything on mount', () => {
    const pb = fakePlayback()
    mount(pb.engine, fakeStemPlayback().engine, props(true), () => audio)

    expect(pb.engine.unload).not.toHaveBeenCalled()
  })

  it('reloads the kept track audio when the transport hands back', () => {
    const pb = fakePlayback()
    const view = handOff(pb, fakeStemPlayback())

    view.rerender(props(false))

    expect(pb.engine.load).toHaveBeenCalledWith(audio)
  })

  it('restores the playhead on the track engine once the reload resolves', async () => {
    const pb = fakePlayback()
    const view = handOff(pb, fakeStemPlayback())

    view.rerender(props(false))
    await act(async () => {})

    expect(pb.engine.seekTo).toHaveBeenCalledWith(5)
  })

  it('does not seek the track engine before the reload resolves', () => {
    const pb = fakePlayback()
    // A reload that never resolves: the seek must be waiting on it.
    pb.engine.load = vi.fn(() => new Promise<void>(() => {}))
    const view = handOff(pb, fakeStemPlayback())

    view.rerender(props(false))

    expect(pb.engine.seekTo).not.toHaveBeenCalled()
  })

  it('skips the playhead restore when a new track took over during the reload', async () => {
    const pb = fakePlayback()
    let resolveLoad!: () => void
    pb.engine.load = vi.fn(
      () => new Promise<void>((resolve) => (resolveLoad = resolve))
    )
    let current: DecodedAudio | undefined = audio
    const view = handOff(pb, fakeStemPlayback(), () => current)

    view.rerender(props(false))
    // A fresh import replaces the kept PCM while the reload is in flight.
    current = { sampleRate: 8, channels: [[1, 0]] }
    await act(async () => resolveLoad())

    expect(pb.engine.seekTo).not.toHaveBeenCalled()
  })

  it('skips the playhead restore when the mix re-took the transport during the reload', async () => {
    const pb = fakePlayback()
    let resolveLoad!: () => void
    pb.engine.load = vi.fn(
      () => new Promise<void>((resolve) => (resolveLoad = resolve))
    )
    const view = handOff(pb, fakeStemPlayback())

    view.rerender(props(false))
    view.rerender(props(true))
    await act(async () => resolveLoad())

    expect(pb.engine.seekTo).not.toHaveBeenCalled()
  })

  it('hands back plainly when no track audio is kept', () => {
    const pb = fakePlayback()
    const view = handOff(pb, fakeStemPlayback(), () => undefined)

    view.rerender(props(false))

    expect(pb.engine.seekTo).toHaveBeenCalledWith(5)
  })

  it('does not reload when no track audio is kept', () => {
    const pb = fakePlayback()
    const view = handOff(pb, fakeStemPlayback(), () => undefined)

    view.rerender(props(false))

    expect(pb.engine.load).not.toHaveBeenCalled()
  })
})
