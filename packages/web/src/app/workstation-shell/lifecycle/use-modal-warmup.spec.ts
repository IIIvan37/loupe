// @vitest-environment jsdom
import type { DecodedAudio } from '@app/core'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useModalWarmup } from './use-modal-warmup.ts'

const track = (): DecodedAudio => ({ sampleRate: 1, channels: [[0]] })

describe('useModalWarmup', () => {
  it('warms once when a track loads', () => {
    const warmUp = vi.fn<(signal: AbortSignal) => void>()
    const audio = track()
    renderHook(({ a }) => useModalWarmup(a, warmUp), {
      initialProps: { a: audio as DecodedAudio | undefined }
    })
    expect(warmUp).toHaveBeenCalledOnce()
    expect(warmUp.mock.calls[0]?.[0]).toBeInstanceOf(AbortSignal)
  })

  it('does not warm without a track', () => {
    const warmUp = vi.fn<(signal: AbortSignal) => void>()
    renderHook(() => useModalWarmup(undefined, warmUp))
    expect(warmUp).not.toHaveBeenCalled()
  })

  it('re-warms and aborts the previous run when the track is replaced', () => {
    const warmUp = vi.fn<(signal: AbortSignal) => void>()
    const { rerender } = renderHook(({ a }) => useModalWarmup(a, warmUp), {
      initialProps: { a: track() as DecodedAudio | undefined }
    })
    const firstSignal = warmUp.mock.calls[0]?.[0] as AbortSignal

    rerender({ a: track() })

    expect(warmUp).toHaveBeenCalledTimes(2)
    // Replacing the track aborts the previous track's prefetch.
    expect(firstSignal.aborted).toBe(true)
  })

  it('aborts the warmup on unmount', () => {
    const warmUp = vi.fn<(signal: AbortSignal) => void>()
    const { unmount } = renderHook(() => useModalWarmup(track(), warmUp))
    const signal = warmUp.mock.calls[0]?.[0] as AbortSignal

    unmount()

    expect(signal.aborted).toBe(true)
  })
})
