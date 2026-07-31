import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProjectStores } from './create-project-stores.ts'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('createProjectStores', () => {
  it('is an inert empty store in the plain browser (no local backend)', async () => {
    // No local server: the browser hides the project UI — so the store lists
    // nothing, persists nothing, and never touches the network.
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    const stores = createProjectStores()
    expect(await stores.store.list()).toEqual([])
    await stores.store.save({} as never)
    await expect(stores.audio.put(new ArrayBuffer(0))).rejects.toThrow(
      /loupe server/
    )

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses the HTTP stores against its own origin in the server shell (D1)', async () => {
    // Served by the local loupe server: the backend IS the serving origin,
    // so the stores talk same-origin (no CORS, no configured base URL).
    vi.stubEnv('VITE_SHELL', 'server')
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost:5173' }
    })
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify([]), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)

    const stores = createProjectStores()
    expect(await stores.store.list()).toEqual([])
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:5173/projects')
  })
})
