import type { DecodedAudio } from '@app/core'
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
})
