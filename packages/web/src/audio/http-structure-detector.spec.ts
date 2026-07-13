import { type DecodedAudio, StructureDetectionError } from '@app/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpStructureDetector } from './http-structure-detector.ts'

const MIX: DecodedAudio = {
  sampleRate: 44100,
  channels: [new Float32Array([0.5, -0.5]), new Float32Array([0.25, -0.25])]
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createHttpStructureDetector', () => {
  it('posts the mix as a WAV to the structure endpoint', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ segments: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await createHttpStructureDetector('http://localhost:8000').detect(MIX)

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('http://localhost:8000/structure')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBeInstanceOf(Uint8Array)
  })

  it('sends the bearer token when one is given (the Modal endpoint)', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ segments: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await createHttpStructureDetector(
      'https://modal.example',
      'secret-tok'
    ).detect(MIX)

    const [, init] = fetchMock.mock.calls[0] ?? []
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer secret-tok'
    )
  })

  it('sends no Authorization against the token-less local server', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ segments: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await createHttpStructureDetector('http://localhost:8000').detect(MIX)

    const [, init] = fetchMock.mock.calls[0] ?? []
    expect(new Headers(init?.headers).get('Authorization')).toBeNull()
  })

  it('forwards the abort signal to the fetch', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ segments: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    await createHttpStructureDetector('http://localhost:8000').detect(
      MIX,
      controller.signal
    )

    const [, init] = fetchMock.mock.calls[0] ?? []
    expect(init?.signal).toBe(controller.signal)
  })

  it('maps the wire segments to detected sections, labels kept raw', async () => {
    // The engine's own vocabulary passes straight through — translating
    // `verse` → « Couplet » is the UI's job (Lingui), not the adapter's.
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          segments: [
            { start: 0, end: 12.5, label: 'intro' },
            { start: 12.5, end: 40, label: 'verse' },
            { start: 40, end: 68, label: 'chorus' }
          ]
        })
      )
    )

    const sections = await createHttpStructureDetector(
      'http://localhost:8000'
    ).detect(MIX)

    expect(sections).toEqual([
      { startSeconds: 0, endSeconds: 12.5, label: 'intro' },
      { startSeconds: 12.5, endSeconds: 40, label: 'verse' },
      { startSeconds: 40, endSeconds: 68, label: 'chorus' }
    ])
  })

  it('throws a clear error when the response body is malformed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ oops: true }))
    )

    await expect(
      createHttpStructureDetector('http://localhost:8000').detect(MIX)
    ).rejects.toThrow('malformed')
  })

  it('types an HTTP 503 as the engine being unavailable', async () => {
    // 503 is the server's "up, but no structure engine installed" answer — the
    // one hint the user can act on (install torch/weights).
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('nope', { status: 503 }))
    )

    await expect(
      createHttpStructureDetector('http://localhost:8000').detect(MIX)
    ).rejects.toMatchObject({
      name: 'StructureDetectionError',
      code: 'engine-unavailable'
    })
  })

  it('types an HTTP 504 as the analysis timing out', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('slow', { status: 504 }))
    )

    await expect(
      createHttpStructureDetector('http://localhost:8000').detect(MIX)
    ).rejects.toMatchObject({
      name: 'StructureDetectionError',
      code: 'timeout'
    })
  })

  it('types an HTTP 413 as the track being too large', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('fat', { status: 413 }))
    )

    await expect(
      createHttpStructureDetector('http://localhost:8000').detect(MIX)
    ).rejects.toMatchObject({
      name: 'StructureDetectionError',
      code: 'too-large'
    })
  })

  it('leaves an unclassified HTTP failure untyped', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('boom', { status: 500 }))
    )

    await expect(
      createHttpStructureDetector('http://localhost:8000').detect(MIX)
    ).rejects.not.toBeInstanceOf(StructureDetectionError)
  })

  it('types an unreachable server as a network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
    )

    await expect(
      createHttpStructureDetector('http://localhost:8000').detect(MIX)
    ).rejects.toMatchObject({
      name: 'StructureDetectionError',
      code: 'network'
    })
  })
})
