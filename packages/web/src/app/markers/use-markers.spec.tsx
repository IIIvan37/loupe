// @vitest-environment jsdom
import type { MarkerList } from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { Provider, useAtomValue } from 'jotai'
import { describe, expect, it, vi } from 'vitest'
import { structureEditSyncAtom } from './marker-atoms.ts'
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

describe('useMarkers — structure edits notify the seated sync', () => {
  function mountWithSync() {
    const onStructureEdited = vi.fn<(next: MarkerList) => void>()
    const hook = renderHook(
      () => ({
        markers: useMarkers(),
        sync: useAtomValue(structureEditSyncAtom)
      }),
      { wrapper: Provider }
    )
    hook.result.current.sync.onStructureEdited = onStructureEdited
    return { hook, onStructureEdited }
  }

  it('adding a section notifies with the new list', () => {
    const { hook, onStructureEdited } = mountWithSync()

    act(() => hook.result.current.markers.addSectionAt(4))

    expect(onStructureEdited).toHaveBeenCalledTimes(1)
    const notified = onStructureEdited.mock.calls[0]?.[0]
    expect(notified?.[0]?.kind).toBe('structure')
    expect(notified?.[0]?.timeSeconds).toBe(4)
  })

  it('renaming, moving and removing a structure marker each notify', () => {
    const { hook, onStructureEdited } = mountWithSync()
    act(() => hook.result.current.markers.addSectionAt(4))
    const id = hook.result.current.markers.markers[0]?.id ?? ''
    onStructureEdited.mockClear()

    act(() => hook.result.current.markers.rename(id, 'Refrain'))
    expect(onStructureEdited.mock.calls[0]?.[0]?.[0]?.label).toBe('Refrain')

    act(() => hook.result.current.markers.move(id, 8))
    expect(onStructureEdited.mock.calls[1]?.[0]?.[0]?.timeSeconds).toBe(8)

    act(() => hook.result.current.markers.remove(id))
    expect(onStructureEdited.mock.calls[2]?.[0]).toHaveLength(0)
  })

  it('cue edits stay silent — only structure shapes the chart', () => {
    const { hook, onStructureEdited } = mountWithSync()
    act(() => hook.result.current.markers.addAt(2))
    const id = hook.result.current.markers.markers[0]?.id ?? ''

    act(() => hook.result.current.markers.rename(id, 'Solo'))
    act(() => hook.result.current.markers.move(id, 3))
    act(() => hook.result.current.markers.remove(id))

    expect(onStructureEdited).not.toHaveBeenCalled()
  })

  it('setSections and restore stay silent — inbound syncs must not bounce', () => {
    const { hook, onStructureEdited } = mountWithSync()

    act(() =>
      hook.result.current.markers.setSections([
        { timeSeconds: 0, label: 'Couplet' }
      ])
    )
    act(() =>
      hook.result.current.markers.restore([
        { id: 'm1', timeSeconds: 4, label: 'Refrain', kind: 'structure' }
      ])
    )

    expect(onStructureEdited).not.toHaveBeenCalled()
  })
})
