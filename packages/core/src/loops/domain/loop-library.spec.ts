import { describe, expect, it } from 'vitest'
import {
  addLoop,
  emptyLoopLibrary,
  type NamedLoop,
  removeLoop
} from './loop-library.ts'

function loop(id: string, startSeconds: number): NamedLoop {
  return {
    id,
    name: id,
    region: { startSeconds, endSeconds: startSeconds + 1 }
  }
}

describe('loop-library', () => {
  it('starts empty', () => {
    expect(emptyLoopLibrary).toEqual([])
  })

  it('keeps loops sorted by start time', () => {
    const library = [loop('a', 5), loop('b', 1), loop('c', 3)].reduce(
      addLoop,
      emptyLoopLibrary
    )
    expect(library.map((l) => l.id)).toEqual(['b', 'c', 'a'])
  })

  it('replaces a loop re-added with the same id', () => {
    const library = addLoop(addLoop(emptyLoopLibrary, loop('a', 2)), {
      id: 'a',
      name: 'renamed',
      region: { startSeconds: 8, endSeconds: 9 }
    })
    expect(library).toHaveLength(1)
    expect(library[0]?.name).toBe('renamed')
    expect(library[0]?.region.startSeconds).toBe(8)
  })

  it('removes a loop by id', () => {
    const library = [loop('a', 1), loop('b', 2)].reduce(
      addLoop,
      emptyLoopLibrary
    )
    expect(removeLoop(library, 'a').map((l) => l.id)).toEqual(['b'])
  })

  it('leaves the library unchanged when removing a missing id', () => {
    const library = addLoop(emptyLoopLibrary, loop('a', 1))
    expect(removeLoop(library, 'zzz')).toEqual(library)
  })
})
