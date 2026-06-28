import { describe, expect, it } from 'vitest'
import type { LoopLibrary } from '../domain/loop-library.ts'
import { deleteLoop, loadLoops, saveLoop } from './loops.ts'
import type { LoopStore } from './ports.ts'

function fakeStore(
  initial: LoopLibrary = []
): LoopStore & { saved: LoopLibrary } {
  return {
    saved: initial,
    async load() {
      return this.saved
    },
    async save(library) {
      this.saved = library
    }
  }
}

const loopA = {
  id: 'a',
  name: 'Verse',
  region: { startSeconds: 1, endSeconds: 3 }
}
const loopB = {
  id: 'b',
  name: 'Chorus',
  region: { startSeconds: 5, endSeconds: 8 }
}

describe('loadLoops', () => {
  it('returns the persisted library', async () => {
    const store = fakeStore([loopA])
    expect(await loadLoops({ store })).toEqual([loopA])
  })

  it('falls back to an empty library when the store fails', async () => {
    const store: LoopStore = {
      load: async () => {
        throw new Error('corrupt')
      },
      save: async () => {}
    }
    expect(await loadLoops({ store })).toEqual([])
  })
})

describe('saveLoop', () => {
  it('adds the loop, persists it, and returns the new library', async () => {
    const store = fakeStore([loopA])
    const next = await saveLoop({ library: [loopA], loop: loopB }, { store })
    expect(next.map((l) => l.id)).toEqual(['a', 'b'])
    expect(store.saved.map((l) => l.id)).toEqual(['a', 'b'])
  })
})

describe('deleteLoop', () => {
  it('removes the loop, persists it, and returns the new library', async () => {
    const store = fakeStore([loopA, loopB])
    const next = await deleteLoop(
      { library: [loopA, loopB], id: 'a' },
      { store }
    )
    expect(next.map((l) => l.id)).toEqual(['b'])
    expect(store.saved.map((l) => l.id)).toEqual(['b'])
  })
})
