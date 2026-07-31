import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTrackSource } from './create-track-source.ts'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('createTrackSource', () => {
  it('rejects URL import in the plain browser (no yt-dlp anywhere)', async () => {
    const source = createTrackSource()
    await expect(source.fetch('https://youtu.be/x', () => {})).rejects.toThrow(
      /serveur|server/i
    )
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
  })
})
