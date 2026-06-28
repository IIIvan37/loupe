import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { Marker } from './marker.ts'
import { addMarker, emptyMarkerList, removeMarker } from './marker-list.ts'

function marker(id: string, timeSeconds: number, label = id): Marker {
  return { id, timeSeconds, label }
}

describe('marker-list', () => {
  it('starts empty', () => {
    expect(emptyMarkerList).toEqual([])
  })

  it('keeps markers sorted by time on insertion', () => {
    const list = [marker('a', 5), marker('b', 1), marker('c', 3)].reduce(
      addMarker,
      emptyMarkerList
    )
    expect(list.map((m) => m.id)).toEqual(['b', 'c', 'a'])
  })

  it('appends a new marker after existing ones at the same time (stable)', () => {
    const list = [marker('a', 2), marker('b', 2)].reduce(
      addMarker,
      emptyMarkerList
    )
    expect(list.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('replaces a marker re-added with the same id', () => {
    const list = addMarker(
      addMarker(emptyMarkerList, marker('a', 2)),
      marker('a', 8)
    )
    expect(list).toHaveLength(1)
    expect(list[0]?.timeSeconds).toBe(8)
  })

  it('removes a marker by id', () => {
    const list = [marker('a', 1), marker('b', 2)].reduce(
      addMarker,
      emptyMarkerList
    )
    expect(removeMarker(list, 'a').map((m) => m.id)).toEqual(['b'])
  })

  it('leaves the list unchanged when removing a missing id', () => {
    const list = addMarker(emptyMarkerList, marker('a', 1))
    expect(removeMarker(list, 'zzz')).toEqual(list)
  })

  // Property: whatever the insertion order, the list is sorted ascending by time.
  it('is always sorted ascending by time', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: 600, noNaN: true }), {
          minLength: 1
        }),
        (times) => {
          const list = times
            .map((t, i) => marker(`m${i}`, t))
            .reduce(addMarker, emptyMarkerList)
          expect(list).toHaveLength(times.length)
          for (let i = 1; i < list.length; i++) {
            const previous = list[i - 1]?.timeSeconds ?? 0
            const current = list[i]?.timeSeconds ?? 0
            expect(current).toBeGreaterThanOrEqual(previous)
          }
        }
      )
    )
  })
})
