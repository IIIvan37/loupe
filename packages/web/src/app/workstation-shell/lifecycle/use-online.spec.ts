// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { vi } from 'vitest'
import { useOnline } from './use-online.ts'

describe('useOnline', () => {
  afterEach(() => vi.restoreAllMocks())

  it('reads the browser connectivity', () => {
    const { result } = renderHook(() => useOnline())
    expect(result.current).toBe(true)
  })

  it('follows the offline and online events live', () => {
    const { result } = renderHook(() => useOnline())

    const gauge = vi.spyOn(window.navigator, 'onLine', 'get')
    gauge.mockReturnValue(false)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)

    gauge.mockReturnValue(true)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe(true)
  })
})
