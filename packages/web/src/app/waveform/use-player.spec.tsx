// @vitest-environment jsdom
import type {
  AudioFileDecoder,
  PlaybackEngine,
  TrackMetadataReader
} from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { Provider } from 'jotai'
import { describe, expect, it, vi } from 'vitest'
import type { PlaybackTransport } from '../audio-session/audio-session.ts'
import { usePlayer } from './use-player.ts'

/** An inert engine — the handle contract needs identities, not sound. */
function fakeEngine(): PlaybackEngine {
  return {
    load: vi.fn(async () => {}),
    play: vi.fn(),
    pause: vi.fn(),
    seekTo: vi.fn(),
    setTimeRatio: vi.fn(),
    setPitchSemitones: vi.fn(),
    unload: vi.fn(),
    onPositionChange: () => () => {}
  }
}

/**
 * The mix as the player sees it: the shared transport, nothing else. A hook
 * reaching for `load`/`addStem`/`stemAudio` would throw here — those belong to
 * the mixer and the separation, through their own slices of the same engine.
 */
function fakeStemTransport(): PlaybackTransport {
  const { play, pause, seekTo, setTimeRatio, setPitchSemitones } = fakeEngine()
  return {
    play,
    pause,
    seekTo,
    setTimeRatio,
    setPitchSemitones,
    onPositionChange: () => () => {}
  }
}

const decoder: AudioFileDecoder = {
  decode: async () => ({ sampleRate: 1, channels: [[0, 1]] })
}
const reader: TrackMetadataReader = {
  read: async () => ({ title: undefined, artist: undefined })
}

function mountPlayer() {
  return renderHook(
    () => usePlayer(decoder, fakeEngine(), reader, fakeStemTransport()),
    { wrapper: Provider }
  )
}

describe('usePlayer — the handle is a stable reference (ADR 0011)', () => {
  it('keeps ONE identity across re-renders and state changes', () => {
    const { result, rerender } = mountPlayer()
    const first = result.current.handle

    rerender()
    expect(result.current.handle).toBe(first)

    // A state change re-renders the owner — the handle must not follow.
    act(() => result.current.handle.toggleLoop())
    expect(result.current.handle).toBe(first)
  })

  it('delegates to the LIVE closures, not the mount-time ones', () => {
    const { result } = mountPlayer()

    // Each toggle must see the state left by the previous one — a handle
    // frozen on the mount-time closure would flip from `true` every time.
    expect(result.current.loopEnabled).toBe(true)
    act(() => result.current.handle.toggleLoop())
    expect(result.current.loopEnabled).toBe(false)
    act(() => result.current.handle.toggleLoop())
    expect(result.current.loopEnabled).toBe(true)
  })
})
