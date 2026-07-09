// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useTapTempo } from './use-tap-tempo.ts'

/** A clock that hands out the given instants, one per tap. */
function clockOf(instants: readonly number[]): () => number {
  let index = 0
  return () => instants[index++] ?? 0
}

describe('useTapTempo', () => {
  it('stays silent on the first tap — one instant is no interval', () => {
    const onBpm = vi.fn()
    const { result } = renderHook(() => useTapTempo(onBpm, clockOf([10])))
    act(() => result.current())
    expect(onBpm).not.toHaveBeenCalled()
  })

  it('reads the tempo from the second tap on', () => {
    const onBpm = vi.fn()
    const { result } = renderHook(() => useTapTempo(onBpm, clockOf([10, 10.5])))
    act(() => result.current())
    act(() => result.current())
    expect(onBpm).toHaveBeenCalledWith(120)
  })

  it('refines the reading as taps accumulate', () => {
    const onBpm = vi.fn()
    const { result } = renderHook(() =>
      useTapTempo(onBpm, clockOf([0, 0.5, 1, 1.5]))
    )
    for (let i = 0; i < 4; i++) {
      act(() => result.current())
    }
    expect(onBpm).toHaveBeenCalledTimes(3)
    expect(onBpm).toHaveBeenLastCalledWith(120)
  })

  it('starts a new sequence after a long silence', () => {
    const onBpm = vi.fn()
    const { result } = renderHook(() =>
      useTapTempo(onBpm, clockOf([0, 0.5, 10]))
    )
    act(() => result.current())
    act(() => result.current())
    act(() => result.current())
    // The third tap opens a fresh sequence: no interval yet, no reading.
    expect(onBpm).toHaveBeenCalledTimes(1)
  })
})
