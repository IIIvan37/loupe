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

  it('detaches the current project so the next save mints a fresh id', async () => {
    const stores = fakeStores()
    const { result } = renderHook(() => useProjects(stores))
    await act(async () => {
      await result.current.save('Premier morceau', input)
    })
    const firstId = result.current.currentId

    act(() => result.current.detach())
    await act(async () => {
      await result.current.save('Deuxième morceau', input)
    })

    expect(result.current.currentId).not.toBe(firstId)
  })

  it('keeps both projects when saving after a detach', async () => {
    const stores = fakeStores()
    const { result } = renderHook(() => useProjects(stores))
    await act(async () => {
      await result.current.save('Premier morceau', input)
    })

    act(() => result.current.detach())
    await act(async () => {
      await result.current.save('Deuxième morceau', input)
    })

    expect(result.current.projects).toHaveLength(2)
  })

  it('does not re-attach when a save resolves after a detach', async () => {
    const working = fakeStores()
    let release: (() => void) | undefined
    const gated: ProjectDeps = {
      store: working.store,
      audio: {
        ...working.audio,
        put: (bytes) =>
          new Promise((resolve) => {
            release = () => resolve(working.audio.put(bytes))
          })
      }
    }
    const { result } = renderHook(() => useProjects(gated))

    let pending: Promise<void> | undefined
    act(() => {
      pending = result.current.save('Mon projet', input)
    })
    // The session moved on (new import) while the save is in flight.
    act(() => result.current.detach())
    await act(async () => {
      release?.()
      await pending
    })

    expect(result.current.currentId).toBeUndefined()
  })

  it('does not re-attach when an open resolves after a detach', async () => {
    const stores = fakeStores()
    const { result } = renderHook(() => useProjects(stores))
    await act(async () => {
      await result.current.save('Mon projet', input)
    })
    const savedId = result.current.currentId as string

    let release: (() => void) | undefined
    const gated: ProjectDeps = {
      store: {
        ...stores.store,
        load: (id) =>
          new Promise((resolve) => {
            release = () => resolve(stores.store.load(id))
          })
      },
      audio: stores.audio
    }
    const { result: fresh } = renderHook(() => useProjects(gated))

    let pending: Promise<unknown> | undefined
    act(() => {
      pending = fresh.current.open(savedId)
    })
    act(() => fresh.current.detach())
    await act(async () => {
      release?.()
      await pending
    })

    expect(fresh.current.currentId).toBeUndefined()
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

  it('flags a failing listing so the dialog can say the server is unreachable', async () => {
    const { result } = renderHook(() => useProjects(brokenStores()))

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.listError).toBe(true)
    expect(result.current.projects).toEqual([])
  })

  it('clears the listing flag once a refresh succeeds again', async () => {
    let broken = true
    const working = fakeStores()
    const stores: ProjectDeps = {
      store: {
        ...working.store,
        list: async () => {
          if (broken) {
            throw new Error('server down')
          }
          return working.store.list()
        }
      },
      audio: working.audio
    }
    const { result } = renderHook(() => useProjects(stores))

    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.listError).toBe(true)

    broken = false
    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.listError).toBe(false)
  })

  it('words a save failure for the user, dismissible from the banner', async () => {
    const { result } = renderHook(() => useProjects(brokenStores()))

    await act(async () => {
      await result.current.save('Mon projet', input)
    })
    expect(result.current.error).toBe(
      "Impossible d'enregistrer le projet : server down"
    )

    act(() => result.current.dismissError())
    expect(result.current.error).toBeUndefined()
  })

  it('words an open failure and a delete failure for the user', async () => {
    const { result } = renderHook(() => useProjects(brokenStores()))

    await act(async () => {
      await result.current.open('missing')
    })
    expect(result.current.error).toBe(
      "Impossible d'ouvrir le projet : server down"
    )

    await act(async () => {
      await result.current.remove('missing')
    })
    expect(result.current.error).toBe(
      'Impossible de supprimer le projet : server down'
    )
  })

  it('reports a save in flight as busy, then idle again', async () => {
    const working = fakeStores()
    let release: (() => void) | undefined
    const stores: ProjectDeps = {
      store: working.store,
      audio: {
        ...working.audio,
        put: (bytes) =>
          new Promise((resolve) => {
            release = () => resolve(working.audio.put(bytes))
          })
      }
    }
    const { result } = renderHook(() => useProjects(stores))

    let pending: Promise<void> | undefined
    act(() => {
      pending = result.current.save('Mon projet', input)
    })
    expect(result.current.busy).toBe('save')

    await act(async () => {
      release?.()
      await pending
    })
    expect(result.current.busy).toBeNull()
    expect(result.current.projects).toHaveLength(1)
  })

  it('reports an open in flight as busy, then idle again', async () => {
    const stores = fakeStores()
    const { result } = renderHook(() => useProjects(stores))
    await act(async () => {
      await result.current.save('Mon projet', input)
    })
    const savedId = result.current.currentId as string

    let release: (() => void) | undefined
    const gated: ProjectDeps = {
      store: {
        ...stores.store,
        load: (id) =>
          new Promise((resolve) => {
            release = () => resolve(stores.store.load(id))
          })
      },
      audio: stores.audio
    }
    const { result: fresh } = renderHook(() => useProjects(gated))

    let pending: Promise<unknown> | undefined
    act(() => {
      pending = fresh.current.open(savedId)
    })
    expect(fresh.current.busy).toBe('open')

    await act(async () => {
      release?.()
      await pending
    })
    expect(fresh.current.busy).toBeNull()
  })
})
