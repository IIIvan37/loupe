// @vitest-environment jsdom
import type { Project, ProjectDeps, SaveProjectInput } from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { useProjects } from './use-projects.ts'

/** In-memory fakes for both project ports, optionally pre-seeded. */
function fakeStores(initial: readonly Project[] = []): ProjectDeps {
  const manifests = new Map(initial.map((project) => [project.id, project]))
  const blobs = new Map<string, ArrayBuffer>()
  let nextRef = 0
  return {
    store: {
      list: async () => [...manifests.values()],
      load: async (id) => manifests.get(id),
      save: async (project) => {
        manifests.set(project.id, project)
      },
      delete: async (id) => {
        manifests.delete(id)
      }
    },
    audio: {
      put: async (bytes) => {
        const ref = `ref-${nextRef++}`
        blobs.set(ref, bytes)
        return ref
      },
      get: async (ref) => blobs.get(ref)
    }
  }
}

/** Stores whose every operation fails, to surface the error path. */
function brokenStores(): ProjectDeps {
  const fail = async () => {
    throw new Error('server down')
  }
  return {
    store: { list: fail, load: fail, save: fail, delete: fail },
    audio: { put: fail, get: fail }
  }
}

const input: Omit<SaveProjectInput, 'stamp'> = {
  source: { title: 'Song', artist: 'Band', bytes: new ArrayBuffer(4) },
  loops: [],
  markers: []
}

describe('useProjects', () => {
  it('saves the session as a fresh project and lists it as current', async () => {
    const { result } = renderHook(() => useProjects(fakeStores()))

    await act(async () => {
      await result.current.save('Mon projet', input)
    })

    expect(result.current.projects).toHaveLength(1)
    expect(result.current.projects[0]?.name).toBe('Mon projet')
    expect(result.current.currentId).toBe(result.current.projects[0]?.id)
    expect(result.current.error).toBeUndefined()
  })

  it('re-saves over the current project instead of minting a new one', async () => {
    const { result } = renderHook(() => useProjects(fakeStores()))

    await act(async () => {
      await result.current.save('Première prise', input)
    })
    const firstId = result.current.currentId
    await act(async () => {
      await result.current.save('Deuxième prise', input)
    })

    expect(result.current.projects).toHaveLength(1)
    expect(result.current.projects[0]?.name).toBe('Deuxième prise')
    expect(result.current.currentId).toBe(firstId)
  })

  it('opens a saved project, making it current and returning the session', async () => {
    const stores = fakeStores()
    const { result } = renderHook(() => useProjects(stores))
    await act(async () => {
      await result.current.save('Mon projet', input)
    })
    const savedId = result.current.currentId as string

    const { result: fresh } = renderHook(() => useProjects(stores))
    let opened: Awaited<ReturnType<typeof fresh.current.open>> | undefined
    await act(async () => {
      opened = await fresh.current.open(savedId)
    })

    expect(opened?.ok).toBe(true)
    expect(fresh.current.currentId).toBe(savedId)
  })

  it('removes a project; removing the current one clears the current id', async () => {
    const { result } = renderHook(() => useProjects(fakeStores()))
    await act(async () => {
      await result.current.save('Mon projet', input)
    })
    const savedId = result.current.currentId as string

    await act(async () => {
      await result.current.remove(savedId)
    })

    expect(result.current.projects).toEqual([])
    expect(result.current.currentId).toBeUndefined()
  })

  it('keeps the error a failing store produces', async () => {
    const { result } = renderHook(() => useProjects(brokenStores()))

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.error).toBe('server down')
    expect(result.current.projects).toEqual([])
  })
})
