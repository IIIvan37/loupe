// @vitest-environment jsdom
import type { LoopRegion } from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useLoop } from './use-loop.ts'

const region = (start: number, end: number): LoopRegion => ({
  startSeconds: start,
  endSeconds: end
})

describe('useLoop', () => {
  it('starts with no region and looping armed', () => {
    const { result } = renderHook(() => useLoop())
    expect(result.current.loopRegion).toBeUndefined()
    expect(result.current.loopEnabled).toBe(true)
  })

  it('re-arms looping when a fresh region is selected from none', () => {
    const { result } = renderHook(() => useLoop())
    act(() => result.current.toggleLoop()) // disarm first
    expect(result.current.loopEnabled).toBe(false)

    act(() => result.current.setLoopRegion(region(2, 6)))
    expect(result.current.loopRegion).toEqual(region(2, 6))
    expect(result.current.loopEnabled).toBe(true)
  })

  it('leaves the wrap choice alone when an existing region is adjusted', () => {
    const { result } = renderHook(() => useLoop())
    act(() => result.current.setLoopRegion(region(2, 6)))
    act(() => result.current.toggleLoop()) // disarm on an existing region
    expect(result.current.loopEnabled).toBe(false)

    act(() => result.current.setLoopRegion(region(2, 8))) // adjust, not fresh
    expect(result.current.loopRegion).toEqual(region(2, 8))
    expect(result.current.loopEnabled).toBe(false)
  })

  it('restores a persisted loupe region and wrap choice together', () => {
    const { result } = renderHook(() => useLoop())
    // A disabled restore must NOT be re-armed by the fresh-selection heuristic.
    act(() => result.current.restoreLoop(region(1, 3), false))
    expect(result.current.loopRegion).toEqual(region(1, 3))
    expect(result.current.loopEnabled).toBe(false)
  })
})
