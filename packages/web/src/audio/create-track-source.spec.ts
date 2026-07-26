import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTrackSource } from './create-track-source.ts'
import { createTauriTrackSource } from './tauri-track-source.ts'

vi.mock('./tauri-download-bridge.ts', () => ({
  createTauriDownloadBridge: vi.fn(() => ({}))
}))
vi.mock('./tauri-track-source.ts', () => ({
  createTauriTrackSource: vi.fn(() => ({ fetch: vi.fn() }))
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('createTrackSource', () => {
  it('rejects URL import in the plain browser (no yt-dlp anywhere)', async () => {
    const source = createTrackSource()
    await expect(source.fetch('https://youtu.be/x', () => {})).rejects.toThrow(
      /desktop|serveur|server/i
    )
    expect(createTauriTrackSource).not.toHaveBeenCalled()
  })

  it('drives the Tauri download bridge inside the desktop shell', () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} })
    createTrackSource()
    expect(createTauriTrackSource).toHaveBeenCalled()
  })

  it('POSTs /download to its own origin in the server shell (D1)', async () => {
    vi.stubEnv('VITE_SHELL', 'server')
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost:5173' }
    })
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 500 })
    )
    vi.stubGlobal('fetch', fetchMock)

    const source = createTrackSource()
    await expect(source.fetch('https://youtu.be/x', () => {})).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:5173/download',
      expect.objectContaining({ method: 'POST' })
    )
    expect(createTauriTrackSource).not.toHaveBeenCalled()
  })
})
