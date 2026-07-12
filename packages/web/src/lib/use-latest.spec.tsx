// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useLatest } from './use-latest.ts'

describe('useLatest', () => {
  it('exposes the initial value on mount', () => {
    const { result } = renderHook(() => useLatest('first'))
    expect(result.current.current).toBe('first')
  })

  it('tracks the freshest value across re-renders', () => {
    const { result, rerender } = renderHook((value: string) => useLatest(value), {
      initialProps: 'first'
    })
    rerender('second')
    expect(result.current.current).toBe('second')
  })

  it('keeps a stable ref identity across re-renders', () => {
    const { result, rerender } = renderHook((value: number) => useLatest(value), {
      initialProps: 1
    })
    const ref = result.current
    rerender(2)
    expect(result.current).toBe(ref)
  })

  it('is fresh by the time a post-commit handler reads it', () => {
    // The whole point of the hook: a mount-once listener or async handler
    // reads the ref later and must see the value of the LAST commit.
    const { result, rerender } = renderHook(
      (onEvent: () => string) => useLatest(onEvent),
      { initialProps: () => 'stale' }
    )
    rerender(() => 'fresh')
    let seen = ''
    act(() => {
      seen = result.current.current()
    })
    expect(seen).toBe('fresh')
  })
})
