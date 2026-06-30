import type { DecodedAudio, SeparationProgress } from '@app/core'
import { encodeWav } from '@app/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpSeparator } from './http-separator.ts'

const MIX: DecodedAudio = {
  sampleRate: 44100,
  channels: [new Float32Array([0.5, -0.5]), new Float32Array([0.25, -0.25])]
}

/** A Response whose body streams the given text as one or more chunks. */
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

/** A Response carrying a stem's WAV bytes. */
function wavResponse(): Response {
  const wav = encodeWav([new Float32Array([1, -1])], 44100)
  return new Response(wav.buffer as ArrayBuffer, { status: 200 })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createHttpSeparator', () => {
  it('posts the mix as a WAV to the separation endpoint', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        ndjsonResponse([
          '{"type":"done","stems":[{"id":"voix","label":"Voix","url":"/stems/1/voix.wav"}]}'
        ])
      )
      .mockImplementation(async () => wavResponse())
    vi.stubGlobal('fetch', fetchMock)

    await createHttpSeparator('http://localhost:8000').separate(MIX, () => {})

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('http://localhost:8000/separate')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBeInstanceOf(Uint8Array)
  })

  it('streams NDJSON progress events to onProgress', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        ndjsonResponse([
          '{"type":"progress","phase":"analysing","fraction":0}',
          '{"type":"progress","phase":"separating","fraction":0.5}',
          '{"type":"done","stems":[{"id":"voix","label":"Voix","url":"/stems/1/voix.wav"}]}'
        ])
      )
      .mockImplementation(async () => wavResponse())
    vi.stubGlobal('fetch', fetchMock)

    const progress: SeparationProgress[] = []
    await createHttpSeparator('http://localhost:8000').separate(MIX, (p) => {
      progress.push(p)
    })

    expect(progress).toEqual([
      { phase: 'analysing', fraction: 0 },
      { phase: 'separating', fraction: 0.5 }
    ])
  })

  it('fetches each stem URL and decodes it into a SeparatedStem', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        ndjsonResponse([
          '{"type":"done","stems":[{"id":"voix","label":"Voix","url":"/stems/1/voix.wav"},{"id":"basse","label":"Basse","url":"/stems/1/basse.wav"}]}'
        ])
      )
      .mockImplementation(async () => wavResponse())
    vi.stubGlobal('fetch', fetchMock)

    const stems = await createHttpSeparator('http://localhost:8000').separate(
      MIX,
      () => {}
    )

    expect(stems.map((s) => s.id)).toEqual(['voix', 'basse'])
    expect(stems[0]?.label).toBe('Voix')
    expect(stems[0]?.audio.sampleRate).toBe(44100)
    expect(stems[0]?.audio.channels[0]?.[0]).toBeCloseTo(1, 4)
    // Stem URL resolved against the base URL.
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'http://localhost:8000/stems/1/voix.wav'
    )
  })

  it('rejects when the server streams an error event', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        ndjsonResponse(['{"type":"error","message":"model failed"}'])
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createHttpSeparator('http://localhost:8000').separate(MIX, () => {})
    ).rejects.toThrow(/model failed/)
  })

  it('rejects when the request itself fails', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('nope', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createHttpSeparator('http://localhost:8000').separate(MIX, () => {})
    ).rejects.toThrow()
  })
})
