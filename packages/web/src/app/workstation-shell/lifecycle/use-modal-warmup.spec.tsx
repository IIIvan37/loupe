// @vitest-environment jsdom
import type { DecodedAudio } from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { loadedAudioAtom } from '../../track/track-atoms.ts'
import { useModalWarmup } from './use-modal-warmup.ts'

const track = (): DecodedAudio => ({ sampleRate: 1, channels: [[0]] })

/** The hook reads the loaded PCM off the player's atom (ADR 0010): the store
 * is the test's seam for « a track loads » / « the track is replaced ». */
function mountWarmup(audio: DecodedAudio | undefined) {
  const warmUp = vi.fn<(signal: AbortSignal) => void>()
  const store = createStore()
  store.set(loadedAudioAtom, audio)
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  )
  const hook = renderHook(() => useModalWarmup(warmUp), { wrapper })
  const replaceTrack = (next: DecodedAudio) =>
    act(() => store.set(loadedAudioAtom, next))
  return { warmUp, hook, replaceTrack }
}

describe('useModalWarmup', () => {
  it('warms once when a track loads', () => {
    const { warmUp } = mountWarmup(track())
    expect(warmUp).toHaveBeenCalledOnce()
    expect(warmUp.mock.calls[0]?.[0]).toBeInstanceOf(AbortSignal)
  })

  it('does not warm without a track', () => {
    const { warmUp } = mountWarmup(undefined)
    expect(warmUp).not.toHaveBeenCalled()
  })

  it('re-warms and aborts the previous run when the track is replaced', () => {
    const { warmUp, replaceTrack } = mountWarmup(track())
    const firstSignal = warmUp.mock.calls[0]?.[0] as AbortSignal

    replaceTrack(track())

    expect(warmUp).toHaveBeenCalledTimes(2)
    // Replacing the track aborts the previous track's prefetch.
    expect(firstSignal.aborted).toBe(true)
  })

  it('aborts the warmup on unmount', () => {
    const { warmUp, hook } = mountWarmup(track())
    const signal = warmUp.mock.calls[0]?.[0] as AbortSignal

    hook.unmount()

    expect(signal.aborted).toBe(true)
  })
})
