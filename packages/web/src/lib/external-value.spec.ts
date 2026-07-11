// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createExternalValue, useExternalValue } from './external-value.ts'

describe('createExternalValue', () => {
  it('serves the value it was seeded with', () => {
    expect(createExternalValue(7).get()).toBe(7)
  })

  it('serves the last set value', () => {
    const value = createExternalValue(0)
    value.set(3.5)
    expect(value.get()).toBe(3.5)
  })

  it('notifies subscribers on a change', () => {
    const value = createExternalValue(0)
    const listener = vi.fn()
    value.subscribe(listener)
    value.set(1)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('does not notify when the value is unchanged', () => {
    // The engine streams one position per frame; an unchanged value (paused
    // engine still emitting) must not wake every subscriber for nothing.
    const value = createExternalValue(2)
    const listener = vi.fn()
    value.subscribe(listener)
    value.set(2)
    expect(listener).not.toHaveBeenCalled()
  })

  it('stops notifying after unsubscribe', () => {
    const value = createExternalValue(0)
    const listener = vi.fn()
    const unsubscribe = value.subscribe(listener)
    unsubscribe()
    value.set(1)
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('useExternalValue', () => {
  it('reads the selected snapshot', () => {
    const value = createExternalValue(90)
    const { result } = renderHook(() =>
      useExternalValue(value, (seconds) => Math.floor(seconds))
    )
    expect(result.current).toBe(90)
  })

  it('re-renders with the new snapshot when the selection changes', () => {
    const value = createExternalValue(0)
    const { result } = renderHook(() =>
      useExternalValue(value, (seconds) => Math.floor(seconds))
    )
    act(() => value.set(4.2))
    expect(result.current).toBe(4)
  })

  it('does not re-render while the selection is stable', () => {
    // THE point of the selector: a 60 Hz playhead only re-renders consumers
    // whose derived view (a timecode second, a measure index) actually moved.
    const value = createExternalValue(0)
    const renders = vi.fn()
    const { result } = renderHook(() => {
      renders()
      return useExternalValue(value, (seconds) => Math.floor(seconds))
    })
    const before = renders.mock.calls.length
    act(() => value.set(0.25))
    act(() => value.set(0.5))
    act(() => value.set(0.75))
    expect([result.current, renders.mock.calls.length]).toEqual([0, before])
  })
})
