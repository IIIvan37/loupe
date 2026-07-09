// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSpeedTrainer } from './use-speed-trainer.ts'

const policy = {
  startPercent: 70,
  incrementPercent: 5,
  passesPerStep: 2,
  targetPercent: 100
}

describe('useSpeedTrainer', () => {
  it('is off until started, and arming seats the start tempo', () => {
    const apply = vi.fn()
    const { result } = renderHook(() => useSpeedTrainer(apply, () => 100))
    expect(result.current.state).toBeUndefined()

    act(() => result.current.start(policy))

    expect(result.current.state?.currentPercent).toBe(70)
    expect(apply).toHaveBeenCalledWith(70)
  })

  it('applies the stepped tempo once the cadence is earned, not before', () => {
    const apply = vi.fn()
    const { result } = renderHook(() => useSpeedTrainer(apply, () => 100))
    act(() => result.current.start(policy))
    apply.mockClear()

    act(() => result.current.recordPass())
    expect(apply).not.toHaveBeenCalled()
    expect(result.current.state?.passesInStep).toBe(1)

    act(() => result.current.recordPass())
    expect(apply).toHaveBeenCalledWith(75)
    expect(result.current.state?.currentPercent).toBe(75)
  })

  it('stop restores the tempo memorised at arming, and later passes are inert', () => {
    const apply = vi.fn()
    // The player was at 100 % when the ramp armed.
    const { result } = renderHook(() => useSpeedTrainer(apply, () => 100))
    act(() => result.current.start(policy))
    act(() => result.current.recordPass())
    act(() => result.current.recordPass())
    expect(result.current.state?.currentPercent).toBe(75)
    apply.mockClear()

    act(() => result.current.stop())
    expect(result.current.state).toBeUndefined()
    expect(apply).toHaveBeenCalledWith(100)

    apply.mockClear()
    act(() => result.current.recordPass())
    expect(apply).not.toHaveBeenCalled()
  })

  it('stopping an already-off trainer applies nothing', () => {
    const apply = vi.fn()
    const { result } = renderHook(() => useSpeedTrainer(apply, () => 100))
    act(() => result.current.stop())
    expect(apply).not.toHaveBeenCalled()
  })

  it('keeps recordPass identity-stable across renders (mount-once listener)', () => {
    const { result, rerender } = renderHook(() =>
      useSpeedTrainer(
        () => {},
        () => 100
      )
    )
    const first = result.current.recordPass
    rerender()
    expect(result.current.recordPass).toBe(first)
  })
})
