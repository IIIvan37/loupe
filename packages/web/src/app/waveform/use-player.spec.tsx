// @vitest-environment jsdom
import type {
  AudioFileDecoder,
  DecodedAudio,
  PlaybackEngine,
  TrackMetadataReader
} from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { PlaybackTransport } from '../audio-session/audio-session.ts'
import {
  loadedAudioAtom,
  loadedBytesAtom,
  trackMetadataAtom
} from '../track/track-atoms.ts'
import { fineTuneCentsAtom, timeRatioAtom } from './player-atoms.ts'
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

const DECODED: DecodedAudio = { sampleRate: 1, channels: [[0, 1]] }
const decoder: AudioFileDecoder = {
  decode: async () => DECODED
}
const reader: TrackMetadataReader = {
  read: async () => ({ title: undefined, artist: undefined })
}

function mountPlayer(store = createStore(), metadataReader = reader) {
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  )
  return renderHook(
    () =>
      usePlayer(decoder, fakeEngine(), metadataReader, fakeStemTransport()),
    { wrapper }
  )
}

describe('usePlayer — the loaded PCM is the feature\'s atom (ADR 0010)', () => {
  it('seats the decoded audio in loadedAudioAtom on a successful import', async () => {
    const store = createStore()
    const { result } = mountPlayer(store)
    expect(store.get(loadedAudioAtom)).toBeUndefined()

    await act(() => result.current.importFile(new File(['x'], 'take.wav')))

    expect(store.get(loadedAudioAtom)).toBe(DECODED)
  })

  it('clears the atom the moment a new import starts', async () => {
    const store = createStore()
    const { result } = mountPlayer(store)
    await act(() => result.current.importFile(new File(['x'], 'take.wav')))

    // A slow decode must not leave the previous track's PCM on offer — the
    // consumers (analyses, export, separation) key on the atom's identity.
    act(() => {
      void result.current.importFile(new File(['y'], 'next.wav'))
    })
    expect(store.get(loadedAudioAtom)).toBeUndefined()
  })
})

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

describe('usePlayer — the track\'s tags and bytes are the feature\'s atoms (ADR 0010)', () => {
  it('seats the fallback tags at once, then lets the file\'s own tags win', async () => {
    const store = createStore()
    const tagged: TrackMetadataReader = {
      read: async () => ({ title: 'Tagged', artist: undefined })
    }
    const { result } = mountPlayer(store, tagged)

    await act(() =>
      result.current.importFile(new File(['x'], 'take.wav'), {
        title: 'Fallback',
        artist: 'Artiste'
      })
    )

    // Embedded tags override only the fields they carry; the fallback fills
    // the rest (a URL download's own artist survives an untagged file).
    expect(store.get(trackMetadataAtom)).toEqual({
      title: 'Tagged',
      artist: 'Artiste'
    })
  })

  it('seats the original bytes on success and drops them when a new import starts', async () => {
    const store = createStore()
    const { result } = mountPlayer(store)
    expect(store.get(loadedBytesAtom)).toBeUndefined()

    await act(() => result.current.importFile(new File(['xy'], 'take.wav')))
    expect(store.get(loadedBytesAtom)?.byteLength).toBe(2)

    act(() => {
      void result.current.importFile(new File(['z'], 'next.wav'))
    })
    expect(store.get(loadedBytesAtom)).toBeUndefined()
  })
})

describe('usePlayer — tempo and fine-tune are the feature\'s atoms (ADR 0010)', () => {
  it('writes the clamped tempo ratio and fine-tune to their atoms', () => {
    const store = createStore()
    const { result } = mountPlayer(store)

    act(() => {
      result.current.setTimeRatio(0.85)
      result.current.setFineTuneCents(500)
    })

    expect(store.get(timeRatioAtom)).toBe(0.85)
    // The domain clamps: ±50 cents is the fine-tune's whole range.
    expect(store.get(fineTuneCentsAtom)).toBe(50)
  })

  it('resets both atoms when a fresh track lands', async () => {
    const store = createStore()
    const { result } = mountPlayer(store)
    act(() => {
      result.current.setTimeRatio(0.85)
      result.current.setFineTuneCents(30)
    })

    await act(() => result.current.importFile(new File(['x'], 'take.wav')))

    expect(store.get(timeRatioAtom)).toBe(1)
    expect(store.get(fineTuneCentsAtom)).toBe(0)
  })
})
