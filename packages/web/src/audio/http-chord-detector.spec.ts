import { ChordDetectionError, type DecodedAudio } from '@app/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpChordDetector } from './http-chord-detector.ts'

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

describe('createHttpChordDetector', () => {
  it('posts the mix as a WAV to the chords endpoint', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ chords: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await createHttpChordDetector('http://localhost:8000').detect(MIX)

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('http://localhost:8000/chords')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBeInstanceOf(Uint8Array)
  })

  it('translates mir labels into the grid token spelling', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          chords: [
            { start: 0, end: 2, label: 'C' },
            { start: 2, end: 4, label: 'A#:min' },
            { start: 4, end: 6, label: 'F#:maj7' },
            { start: 6, end: 8, label: 'G:7' }
          ]
        })
      )
    )

    const spans = await createHttpChordDetector('http://localhost:8000').detect(
      MIX
    )

    expect(spans).toEqual([
      { startSeconds: 0, endSeconds: 2, label: 'C' },
      { startSeconds: 2, endSeconds: 4, label: 'A#m' },
      { startSeconds: 4, endSeconds: 6, label: 'F#maj7' },
      { startSeconds: 6, endSeconds: 8, label: 'G7' }
    ])
  })

  it('reads the no-chord labels as silence', async () => {
    // `N` = no chord; `X` = the large vocabulary's "unknown" — both are
    // silence to the grid, never a token.
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          chords: [
            { start: 0, end: 2, label: 'N' },
            { start: 2, end: 4, label: 'X' }
          ]
        })
      )
    )

    const spans = await createHttpChordDetector('http://localhost:8000').detect(
      MIX
    )

    expect(spans.map((span) => span.label)).toEqual([undefined, undefined])
  })

  it('strips the explicit :maj quality — the token spelling is bare', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse({ chords: [{ start: 0, end: 2, label: 'D:maj' }] })
        )
    )

    const spans = await createHttpChordDetector('http://localhost:8000').detect(
      MIX
    )

    expect(spans[0]?.label).toBe('D')
  })

  it('throws a clear error when the response body is malformed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ oops: true }))
    )

    await expect(
      createHttpChordDetector('http://localhost:8000').detect(MIX)
    ).rejects.toThrow('malformed')
  })

  it('throws when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('nope', { status: 503 }))
    )

    await expect(
      createHttpChordDetector('http://localhost:8000').detect(MIX)
    ).rejects.toThrow('HTTP 503')
  })

  it('types an HTTP 503 as the engine being unavailable', async () => {
    // 503 is the server's "up, but no chord engine installed" answer — the
    // one hint the user can act on (install torch/weights), so it gets its
    // own code instead of folding into `unknown`.
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('nope', { status: 503 }))
    )

    await expect(
      createHttpChordDetector('http://localhost:8000').detect(MIX)
    ).rejects.toMatchObject({
      name: 'ChordDetectionError',
      code: 'engine-unavailable'
    })
  })

  it('types an HTTP 504 as the analysis timing out', async () => {
    // The server's inference timeout answers 504 — actionable (shorter
    // track, retry), so it must not fold into `unknown`.
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('slow', { status: 504 }))
    )

    await expect(
      createHttpChordDetector('http://localhost:8000').detect(MIX)
    ).rejects.toMatchObject({ name: 'ChordDetectionError', code: 'timeout' })
  })

  it('types an HTTP 413 as the track being too large', async () => {
    // The server caps the upload body — a long track trips it.
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('fat', { status: 413 }))
    )

    await expect(
      createHttpChordDetector('http://localhost:8000').detect(MIX)
    ).rejects.toMatchObject({ name: 'ChordDetectionError', code: 'too-large' })
  })

  it('leaves an unclassified HTTP failure untyped', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('boom', { status: 500 }))
    )

    await expect(
      createHttpChordDetector('http://localhost:8000').detect(MIX)
    ).rejects.not.toBeInstanceOf(ChordDetectionError)
  })

  it('types an unreachable server as a network failure', async () => {
    // What `fetch` throws when the server is down or offline.
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
    )

    await expect(
      createHttpChordDetector('http://localhost:8000').detect(MIX)
    ).rejects.toMatchObject({ name: 'ChordDetectionError', code: 'network' })
  })
})
