import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProjectStores } from './create-project-stores.ts'
import { collectFsGarbage, type ProjectFs } from './fs-project-store.ts'
import { createTauriProjectFs } from './tauri-fs.ts'

vi.mock('./tauri-fs.ts', () => ({
  createTauriProjectFs: vi.fn(() => ({}))
}))
vi.mock('./fs-project-store.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./fs-project-store.ts')>()),
  collectFsGarbage: vi.fn(async () => ({ deleted: 0, kept: 0, skipped: false }))
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function recordingFs(): ProjectFs {
  return {
    mkdir: vi.fn(async () => {}),
    readDir: vi.fn(async () => []),
    readTextFile: vi.fn(async () => ''),
    writeTextFile: vi.fn(async () => {}),
    readFile: vi.fn(async () => new Uint8Array()),
    writeFile: vi.fn(async () => {}),
    rename: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    exists: vi.fn(async () => false)
  }
}

const microtasks = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('createProjectStores', () => {
  it('talks to the local server outside the Tauri shell', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json([]))
    vi.stubGlobal('fetch', fetchMock)

    await createProjectStores().store.list()

    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/projects$/)
    expect(createTauriProjectFs).not.toHaveBeenCalled()
  })

  it('uses the filesystem stores in the Tauri shell, gated behind one startup sweep', async () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} })
    const fs = recordingFs()
    vi.mocked(createTauriProjectFs).mockReturnValue(fs)
    let finishSweep!: () => void
    vi.mocked(collectFsGarbage).mockReturnValue(
      new Promise((resolve) => {
        finishSweep = () => resolve({ deleted: 0, kept: 0, skipped: false })
      })
    )

    const stores = createProjectStores()
    const listing = stores.store.list()
    await microtasks()
    // A blob stored while the sweep snapshots live refs would look orphaned:
    // no operation may touch the tree until the sweep is done (the server
    // runs its GC in the lifespan hook before serving for the same reason).
    expect(fs.readDir).not.toHaveBeenCalled()

    finishSweep()
    await listing
    expect(fs.readDir).toHaveBeenCalled()

    // Like the server's lifespan GC: one sweep per app run, not per mount.
    createProjectStores()
    expect(collectFsGarbage).toHaveBeenCalledTimes(1)
  })
})
