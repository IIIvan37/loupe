// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { Provider } from 'jotai'
import { describe, expect, it } from 'vitest'
import { useMarkers } from './use-markers.ts'

/** Two consumers of the hook, as the regions and the shell now are. */
function mountTwoConsumers() {
  return renderHook(() => ({ first: useMarkers(), second: useMarkers() }), {
    wrapper: Provider
  })
}

describe('useMarkers — the list is feature state, not owner state (ADR 0010)', () => {
  it('shows every consumer the same list', () => {
    const { result } = mountTwoConsumers()

    act(() => result.current.first.addAt(1.5))

    // The second consumer sees the marker the first one dropped — the list
    // lives in the feature's atom, not in whichever component called first.
    expect(result.current.second.markers).toHaveLength(1)
    expect(result.current.second.markers[0]?.timeSeconds).toBe(1.5)
  })

  it('routes every transition through the shared list', () => {
    const { result } = mountTwoConsumers()

    act(() => result.current.first.addAt(1))
    const id = result.current.second.markers[0]?.id ?? ''

    act(() => result.current.second.rename(id, 'Solo'))
    expect(result.current.first.markers[0]?.label).toBe('Solo')

    act(() => result.current.first.move(id, 2.5))
    expect(result.current.second.markers[0]?.timeSeconds).toBe(2.5)

    act(() => result.current.second.remove(id))
    expect(result.current.first.markers).toHaveLength(0)
  })

  it('keeps stores isolated between mounts', () => {
    const first = mountTwoConsumers()
    act(() => first.result.current.first.addAt(1))
    first.unmount()

    // A fresh Provider starts from an empty list — no leak across sessions.
    const second = mountTwoConsumers()
    expect(second.result.current.first.markers).toHaveLength(0)
  })
})
