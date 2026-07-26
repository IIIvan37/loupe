import { describe, expect, it } from 'vitest'
import type { ProjectStore } from '../application/ports.ts'
import type { Project } from '../domain/project.ts'

/**
 * Port **contract test** for `ProjectStore`: the obligations an implementation
 * must honour, written once against the interface and replayed against every
 * implementation — the in-memory reference fake and each real adapter alike
 * (see docs/adr/0002). A unit test of one adapter only proves that adapter
 * behaves; the contract is what proves they are substitutable.
 *
 * It states only what the core relies on. Notably, `list` promises no order:
 * `listProjects` sorts by `updatedAt` itself. Anything adapter-specific
 * (path-hostile ids, atomic writes, corrupt manifests) belongs in that
 * adapter's own spec.
 */

/** What a `ProjectStore` implementation must provide to be contract-tested. */
export interface ProjectStoreSubject {
  readonly store: ProjectStore
}

// A realistic manifest: the audioRef carries the real contract's shape — a
// content-addressed sha-256 hex, minted by `ProjectAudioStore.put`.
const projectOf = (id: string, name: string): Project => ({
  id,
  name,
  createdAt: 1_000,
  updatedAt: 1_000,
  source: { title: 'Song', artist: 'Band', audioRef: 'f'.repeat(64) },
  loops: [],
  markers: []
})

const byId = (a: Project, b: Project): number => a.id.localeCompare(b.id)

/**
 * Replay the `ProjectStore` contract against one implementation.
 * `createSubject` must return a FRESH subject on every call — the contract
 * relies on each case starting from an empty store.
 */
export function projectStoreContract(
  label: string,
  createSubject: () => ProjectStoreSubject
): void {
  describe(`${label} — ProjectStore contract`, () => {
    it('resolves an unknown id to undefined', async () => {
      const { store } = createSubject()
      await expect(store.load('never-saved')).resolves.toBeUndefined()
    })

    it('round-trips a saved project by id', async () => {
      const { store } = createSubject()
      const project = projectOf('p1', 'My take')
      await store.save(project)
      await expect(store.load('p1')).resolves.toEqual(project)
    })

    it('replaces the manifest on re-save of the same id', async () => {
      const { store } = createSubject()
      await store.save(projectOf('p1', 'First take'))
      const renamed = { ...projectOf('p1', 'Second take'), updatedAt: 2_000 }
      await store.save(renamed)
      await expect(store.load('p1')).resolves.toEqual(renamed)
    })

    it('lists every saved project, in no promised order', async () => {
      const { store } = createSubject()
      const one = projectOf('p1', 'My take')
      const two = projectOf('p2', 'Other take')
      await store.save(one)
      await store.save(two)
      expect([...(await store.list())].sort(byId)).toEqual([one, two])
    })

    it('lists nothing while nothing was saved', async () => {
      const { store } = createSubject()
      await expect(store.list()).resolves.toEqual([])
    })

    it('no longer knows a deleted project', async () => {
      const { store } = createSubject()
      await store.save(projectOf('p1', 'My take'))
      await store.delete('p1')
      await expect(store.load('p1')).resolves.toBeUndefined()
      await expect(store.list()).resolves.toEqual([])
    })

    it('treats deleting an unknown id as a no-op', async () => {
      const { store } = createSubject()
      await expect(store.delete('never-saved')).resolves.toBeUndefined()
    })

    it('leaves the project it was given untouched', async () => {
      const { store } = createSubject()
      const project = projectOf('p1', 'My take')
      await store.save(project)
      expect(project).toEqual(projectOf('p1', 'My take'))
    })
  })
}
