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
    const { result } = renderHook(() => useSpeedTrainer(apply))
    expect(result.current.state).toBeUndefined()

    act(() => result.current.start(policy))

    expect(result.current.state?.currentPercent).toBe(70)
    expect(apply).toHaveBeenCalledWith(70)
  })

  it('applies the stepped tempo once the cadence is earned, not before', () => {
    const apply = vi.fn()
    const { result } = renderHook(() => useSpeedTrainer(apply))
    act(() => result.current.start(policy))
    apply.mockClear()

    act(() => result.current.recordPass())
    expect(apply).not.toHaveBeenCalled()
    expect(result.current.state?.passesInStep).toBe(1)

    act(() => result.current.recordPass())
    expect(apply).toHaveBeenCalledWith(75)
    expect(result.current.state?.currentPercent).toBe(75)
  })

  it('stops without touching the tempo, and later passes are inert', () => {
    const apply = vi.fn()
    const { result } = renderHook(() => useSpeedTrainer(apply))
    act(() => result.current.start(policy))
    apply.mockClear()

    act(() => result.current.stop())
    expect(result.current.state).toBeUndefined()

    act(() => result.current.recordPass())
    expect(apply).not.toHaveBeenCalled()
  })

  it('keeps recordPass identity-stable across renders (mount-once listener)', () => {
    const { result, rerender } = renderHook(() => useSpeedTrainer(() => {}))
    const first = result.current.recordPass
    rerender()
    expect(result.current.recordPass).toBe(first)
  })
})
