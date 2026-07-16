import type { DecodedAudio } from '@app/core'
import { TempoDetectionError } from '@app/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { encodeAnalysisWavMemo } from './encode-analysis-wav-memo.ts'
import { createHttpTempoDetector } from './http-tempo-detector.ts'

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

describe('createHttpTempoDetector', () => {
  it('posts the mix as a mono analysis WAV to the tempo endpoint', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        bpm: 120,
        beats: [{ time: 0, position: 1 }]
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    await createHttpTempoDetector('http://localhost:8000').detect(MIX)

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('http://localhost:8000/tempo')
    expect(init?.method).toBe('POST')
    // The memo hands back the identical byte array for the same audio, so
    // this pins "the analysis WAV was posted" without re-deriving the
    // encoding policy (which encode-analysis-wav-memo.spec.ts owns).
    expect(init?.body).toBe(await encodeAnalysisWavMemo(MIX))
  })

  it('forwards the abort signal to the fetch', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ bpm: 120, beats: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    await createHttpTempoDetector('http://localhost:8000').detect(
      MIX,
      controller.signal
    )

    const [, init] = fetchMock.mock.calls[0] ?? []
    expect(init?.signal).toBe(controller.signal)
  })

  it('maps positioned beats into a DetectedTempo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          bpm: 96.5,
          beats: [
            { time: 0, position: 1 },
            { time: 0.62, position: 2 },
            { time: 1.25, position: 3 }
          ]
        })
      )
    )

    const detected = await createHttpTempoDetector(
      'http://localhost:8000'
    ).detect(MIX)

    expect(detected).toEqual({
      bpm: 96.5,
      beats: [
        { timeSeconds: 0, barPosition: 1 },
        { timeSeconds: 0.62, barPosition: 2 },
        { timeSeconds: 1.25, barPosition: 3 }
      ]
    })
  })

  it('tolerates a legacy server that returns bare beat seconds', async () => {
    // The librosa server has no downbeats — count positions in common time so
    // the app keeps working until the beat_this server ships.
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse({ bpm: 120, beats: [0, 0.5, 1, 1.5, 2] })
        )
    )

    const detected = await createHttpTempoDetector(
      'http://localhost:8000'
    ).detect(MIX)

    expect(detected.beats.map((beat) => beat.barPosition)).toEqual([
      1, 2, 3, 4, 1
    ])
  })

  it('throws a clear error when the response body is malformed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ oops: true }))
    )

    await expect(
      createHttpTempoDetector('http://localhost:8000').detect(MIX)
    ).rejects.toThrow('malformed')
  })

  it('throws when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('nope', { status: 500 }))
    )

    await expect(
      createHttpTempoDetector('http://localhost:8000').detect(MIX)
    ).rejects.toThrow('HTTP 500')
  })

  it.each([
    [503, 'engine-unavailable'],
    [504, 'timeout'],
    [413, 'too-large']
  ] as const)('types an HTTP %i as the %s code', async (status, code) => {
    // The statuses this server answers deliberately (same contract as the
    // chords adapter — classifyTransportError is shared) become the port's
    // typed error, so the panel can speak each case.
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response('nope', { status }))
    )

    await expect(
      createHttpTempoDetector('http://localhost:8000').detect(MIX)
    ).rejects.toMatchObject({ name: 'TempoDetectionError', code })
  })

  it('types an unreachable server as a network failure', async () => {
    // What `fetch` throws when the server is down or offline.
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'))
    )

    await expect(
      createHttpTempoDetector('http://localhost:8000').detect(MIX)
    ).rejects.toMatchObject({ name: 'TempoDetectionError', code: 'network' })
  })

  it('leaves an unclassified HTTP failure untyped', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('boom', { status: 500 }))
    )

    await expect(
      createHttpTempoDetector('http://localhost:8000').detect(MIX)
    ).rejects.not.toBeInstanceOf(TempoDetectionError)
  })
})
