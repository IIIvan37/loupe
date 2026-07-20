// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCountdown } from './use-countdown.ts'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useCountdown', () => {
  it('starts idle at zero', () => {
    const { result } = renderHook(() => useCountdown())
    expect(result.current.secondsLeft).toBe(0)
  })

  it('counts down one second at a time to zero, then stops', () => {
    const { result } = renderHook(() => useCountdown())

    act(() => result.current.start(3))
    expect(result.current.secondsLeft).toBe(3)

    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.secondsLeft).toBe(2)

    act(() => vi.advanceTimersByTime(2000))
    expect(result.current.secondsLeft).toBe(0)

    // No underflow once it has settled at zero.
    act(() => vi.advanceTimersByTime(3000))
    expect(result.current.secondsLeft).toBe(0)
  })

  it('restarts from the new value when started again', () => {
    const { result } = renderHook(() => useCountdown())

    act(() => result.current.start(2))
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.secondsLeft).toBe(1)

    act(() => result.current.start(5))
    expect(result.current.secondsLeft).toBe(5)
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.secondsLeft).toBe(4)
  })

  it('clears its interval on unmount (no stray ticks)', () => {
    const { result, unmount } = renderHook(() => useCountdown())
    act(() => result.current.start(3))
    unmount()
    // Advancing after unmount must not throw or tick a gone component.
    expect(() => vi.advanceTimersByTime(3000)).not.toThrow()
  })
})
