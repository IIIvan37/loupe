import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { Marker } from './marker.ts'
import {
  addMarker,
  emptyMarkerList,
  moveMarker,
  removeMarker,
  replaceStructureMarkers
} from './marker-list.ts'

function marker(id: string, timeSeconds: number, label = id): Marker {
  return { id, timeSeconds, label }
}

function structureMarker(id: string, timeSeconds: number, label = id): Marker {
  return { id, timeSeconds, label, kind: 'structure' }
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

  it('moves a marker to a new time', () => {
    const list = [marker('a', 1), marker('b', 4)].reduce(
      addMarker,
      emptyMarkerList
    )
    const moved = moveMarker(list, 'a', 8)
    expect(moved.find((m) => m.id === 'a')?.timeSeconds).toBe(8)
  })

  it('re-sorts the list when a move crosses another marker', () => {
    const list = [marker('a', 1), marker('b', 4)].reduce(
      addMarker,
      emptyMarkerList
    )
    expect(moveMarker(list, 'a', 8).map((m) => m.id)).toEqual(['b', 'a'])
  })

  it('keeps the label of a moved marker', () => {
    const list = addMarker(emptyMarkerList, marker('a', 1, 'Couplet 1'))
    expect(moveMarker(list, 'a', 8)[0]?.label).toBe('Couplet 1')
  })

  it('leaves the list unchanged when moving a missing id', () => {
    const list = addMarker(emptyMarkerList, marker('a', 1))
    expect(moveMarker(list, 'zzz', 8)).toEqual(list)
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

describe('replaceStructureMarkers', () => {
  it('replaces the structure markers and keeps the cues', () => {
    const list = [
      structureMarker('old-intro', 0, 'Intro'),
      marker('cue', 12, 'Tricky bar'),
      structureMarker('old-chorus', 30, 'Refrain')
    ].reduce(addMarker, emptyMarkerList)
    const next = replaceStructureMarkers(list, [
      structureMarker('new-verse', 4, 'Couplet'),
      structureMarker('new-chorus', 28, 'Refrain')
    ])
    expect(next.map((m) => m.id)).toEqual(['new-verse', 'cue', 'new-chorus'])
  })

  it('keeps the merged list sorted by time', () => {
    const list = [marker('cue', 10)].reduce(addMarker, emptyMarkerList)
    const next = replaceStructureMarkers(list, [
      structureMarker('b', 20),
      structureMarker('a', 5)
    ])
    expect(next.map((m) => m.id)).toEqual(['a', 'cue', 'b'])
  })

  it('with no structure markers to place, only drops the old ones', () => {
    const list = [structureMarker('old', 0, 'Intro'), marker('cue', 12)].reduce(
      addMarker,
      emptyMarkerList
    )
    expect(replaceStructureMarkers(list, [])).toEqual([
      expect.objectContaining({ id: 'cue' })
    ])
  })

  it('on an empty list, simply places the structure markers', () => {
    expect(
      replaceStructureMarkers(emptyMarkerList, [structureMarker('s', 3)]).map(
        (m) => m.id
      )
    ).toEqual(['s'])
  })
})
