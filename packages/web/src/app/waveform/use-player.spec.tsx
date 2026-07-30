// @vitest-environment jsdom
import type {
  AudioFileDecoder,
  PlaybackEngine,
  StemPlaybackEngine,
  TrackMetadataReader
} from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { Provider } from 'jotai'
import { describe, expect, it, vi } from 'vitest'
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

function fakeStemEngine(): StemPlaybackEngine {
  return {
    ...fakeEngine(),
    load: vi.fn(async () => {}),
    addStem: vi.fn(async () => {}),
    removeStem: vi.fn(),
    setGain: vi.fn(),
    stemAudio: () => undefined
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
    () => usePlayer(decoder, fakeEngine(), reader, fakeStemEngine()),
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
