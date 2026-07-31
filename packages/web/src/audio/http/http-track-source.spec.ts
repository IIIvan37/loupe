import type { DownloadProgress } from '@app/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpTrackSource } from './http-track-source.ts'

/** A Response whose body streams the given lines as NDJSON. */
function ndjsonResponse(lines: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      for (const line of lines) {
        controller.enqueue(encoder.encode(`${line}\n`))
      }
      controller.close()
    }
  })
  return new Response(body, { status: 200 })
}

/** A Response carrying the downloaded audio bytes. */
function audioResponse(): Response {
  return new Response(new Uint8Array([1, 2, 3, 4]).buffer, { status: 200 })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createHttpTrackSource', () => {
  it('posts the URL as JSON to the download endpoint', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        ndjsonResponse(['{"type":"done","ref":"abc","title":"Song"}'])
      )
      .mockImplementation(async () => audioResponse())
    vi.stubGlobal('fetch', fetchMock)

    await createHttpTrackSource('http://localhost:8000').fetch(
      'https://youtu.be/x',
      () => {}
    )

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('http://localhost:8000/download')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe('{"url":"https://youtu.be/x"}')
  })

  it('streams NDJSON progress events to onProgress', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        ndjsonResponse([
          '{"type":"progress","phase":"downloading","fraction":0.5}',
          '{"type":"progress","phase":"transcoding","fraction":1}',
          '{"type":"done","ref":"abc","title":"Song"}'
        ])
      )
      .mockImplementation(async () => audioResponse())
    vi.stubGlobal('fetch', fetchMock)

    const progress: DownloadProgress[] = []
    await createHttpTrackSource('http://localhost:8000').fetch(
      'https://youtu.be/x',
      (p) => {
        progress.push(p)
      }
    )

    expect(progress).toEqual([
      { phase: 'downloading', fraction: 0.5 },
      { phase: 'transcoding', fraction: 1 }
    ])
  })

  it('fetches the parked audio by ref and returns bytes + metadata', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        ndjsonResponse([
          '{"type":"done","ref":"abc","title":"Song","duration":123,"uploader":"Artist"}'
        ])
      )
      .mockImplementation(async () => audioResponse())
    vi.stubGlobal('fetch', fetchMock)

    const track = await createHttpTrackSource('http://localhost:8000').fetch(
      'https://youtu.be/x',
      () => {}
    )

    // Bytes fetched from the content-addressed store by ref.
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://localhost:8000/audio/abc')
    expect(new Uint8Array(track.bytes)).toEqual(new Uint8Array([1, 2, 3, 4]))
    expect(track.metadata).toEqual({
      title: 'Song',
      durationSeconds: 123,
      artist: 'Artist'
    })
  })

  it('omits optional metadata the source did not report', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        ndjsonResponse(['{"type":"done","ref":"abc","title":"Song"}'])
      )
      .mockImplementation(async () => audioResponse())
    vi.stubGlobal('fetch', fetchMock)

    const track = await createHttpTrackSource('http://localhost:8000').fetch(
      'https://youtu.be/x',
      () => {}
    )

    expect(track.metadata).toEqual({ title: 'Song' })
  })

  it('rejects when the server streams an error event', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        ndjsonResponse(['{"type":"error","message":"unsupported url"}'])
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createHttpTrackSource('http://localhost:8000').fetch(
        'https://youtu.be/x',
        () => {}
      )
    ).rejects.toThrow(/unsupported url/)
  })

  it('rejects when the download request itself fails', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('nope', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createHttpTrackSource('http://localhost:8000').fetch(
        'https://youtu.be/x',
        () => {}
      )
    ).rejects.toThrow()
  })

  it('rejects when the stream ends without a done event', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        ndjsonResponse([
          '{"type":"progress","phase":"downloading","fraction":1}'
        ])
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createHttpTrackSource('http://localhost:8000').fetch(
        'https://youtu.be/x',
        () => {}
      )
    ).rejects.toThrow(/without a result/)
  })

  it('rejects when the parked audio cannot be fetched', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        ndjsonResponse(['{"type":"done","ref":"abc","title":"Song"}'])
      )
      .mockResolvedValueOnce(new Response('gone', { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createHttpTrackSource('http://localhost:8000').fetch(
        'https://youtu.be/x',
        () => {}
      )
    ).rejects.toThrow(/audio fetch failed/)
  })
})
