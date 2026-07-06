import type { DecodedAudio } from '@app/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
  it('posts the mix as a WAV to the tempo endpoint', async () => {
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
    expect(init?.body).toBeInstanceOf(Uint8Array)
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
})
