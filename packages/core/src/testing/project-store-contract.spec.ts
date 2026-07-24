import { describe, expect, it } from 'vitest'
import { createInMemoryProjectStore } from './in-memory-project-store.ts'
import { projectStoreContract } from './project-store-contract.ts'

// The in-memory store is the reference implementation: if it fails the
// contract, the contract is wrong. Every real adapter replays this same suite.
projectStoreContract('createInMemoryProjectStore', () => ({
  store: createInMemoryProjectStore()
}))

describe('createInMemoryProjectStore — beyond the contract', () => {
  it('starts from the projects it was seeded with', async () => {
    const seed = {
      id: 'p1',
      name: 'My take',
      createdAt: 1_000,
      updatedAt: 1_000,
      source: { title: 'Song', artist: 'Band', audioRef: 'f'.repeat(64) },
      loops: [],
      markers: []
    }
    const store = createInMemoryProjectStore([seed])
    await expect(store.load('p1')).resolves.toEqual(seed)
  })

  it('exposes its state for direct assertion in specs', async () => {
    const store = createInMemoryProjectStore()
    await store.save({
      id: 'p1',
      name: 'My take',
      createdAt: 1_000,
      updatedAt: 1_000,
      source: { title: 'Song', artist: 'Band', audioRef: 'f'.repeat(64) },
      loops: [],
      markers: []
    })
    expect(store.saved.get('p1')?.name).toBe('My take')
  })
})
