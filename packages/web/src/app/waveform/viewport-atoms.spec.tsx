// @vitest-environment jsdom
import { MAX_ZOOM, MIN_ZOOM } from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { useViewport } from './use-viewport.ts'

/**
 * Two `useViewport` consumers under ONE store — the shape the regions reach
 * when they read the hook themselves (ADR 0010): the zoom is session state,
 * so the stage's controls and the shell's shortcuts drive the SAME level
 * without a prop threaded between them.
 */
function mountTwoViewports() {
  const store = createStore()
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  )
  const a = renderHook(() => useViewport(), { wrapper })
  const b = renderHook(() => useViewport(), { wrapper })
  return { a, b }
}

describe('useViewport across two consumers (one store)', () => {
  it('shares a zoom-in: stepped by one, seen by the other', () => {
    const { a, b } = mountTwoViewports()

    act(() => a.result.current.zoomIn())

    expect(b.result.current.zoom).toBe(a.result.current.zoom)
    expect(b.result.current.zoom).toBeGreaterThan(MIN_ZOOM)
  })

  it('shares an absolute level, clamped by the domain', () => {
    const { a, b } = mountTwoViewports()

    act(() => a.result.current.setZoom(MAX_ZOOM + 10))

    expect(b.result.current.zoom).toBe(MAX_ZOOM)
  })

  it('a reset from another consumer zooms everyone back out', () => {
    // A new track resets through the session hook the level the stage shows.
    const { a, b } = mountTwoViewports()
    act(() => b.result.current.zoomIn())

    act(() => a.result.current.reset())

    expect(b.result.current.zoom).toBe(MIN_ZOOM)
  })
})
