import { describe, expect, it, vi } from 'vitest'
import { ImportUrlError, importFromUrl } from './import-from-url.ts'
import type { DownloadProgress, FetchedTrack, TrackSource } from './ports.ts'

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=abc123'

const fetched: FetchedTrack = {
  bytes: new Uint8Array([1, 2, 3, 4]).buffer,
  metadata: { title: 'A Song', durationSeconds: 123, artist: 'An Artist' }
}

/** Fake source: records the url it was asked for, emits progress, returns bytes. */
function fakeSource(events: DownloadProgress[] = []): TrackSource & {
  readonly calls: string[]
} {
  const calls: string[] = []
  return {
    calls,
    async fetch(url, onProgress) {
      calls.push(url)
      for (const event of events) onProgress(event)
      return fetched
    }
  }
}

describe('importFromUrl — when the URL is a supported source', () => {
  it('returns the fetched bytes and metadata, ready for loadTrack', async () => {
    const source = fakeSource()
    const result = await importFromUrl({ url: YOUTUBE_URL }, { source })
    if (!result.ok) throw new Error('expected ok')
    expect(result.bytes).toBe(fetched.bytes)
    expect(result.metadata).toEqual(fetched.metadata)
    expect(source.calls).toEqual([YOUTUBE_URL])
  })

  it('forwards every progress event to the optional sink', async () => {
    const events: DownloadProgress[] = [
      { phase: 'downloading', fraction: 0.5 },
      { phase: 'transcoding', fraction: 1 }
    ]
    const onProgress = vi.fn()
    await importFromUrl(
      { url: YOUTUBE_URL },
      { source: fakeSource(events), onProgress }
    )
    expect(onProgress.mock.calls.map(([p]) => p)).toEqual(events)
  })

  it('hands the abort signal through to the source port', async () => {
    const controller = new AbortController()
    let received: AbortSignal | undefined
    const source: TrackSource = {
      async fetch(_url, _onProgress, signal) {
        received = signal
        return fetched
      }
    }
    await importFromUrl(
      { url: YOUTUBE_URL },
      { source, signal: controller.signal }
    )
    expect(received).toBe(controller.signal)
  })
})

describe('importFromUrl — when the URL is not a supported source', () => {
  it('rejects it with the unsupported code without ever calling the source', async () => {
    const source = fakeSource()
    const result = await importFromUrl(
      { url: 'https://open.spotify.com/track/xyz' },
      { source }
    )
    if (result.ok) throw new Error('expected error')
    expect(result.code).toBe('unsupported')
    expect(result.detail).toContain('unsupported source URL')
    expect(source.calls).toEqual([])
  })
})

describe('importFromUrl — when the source fails', () => {
  it('keeps the typed code the port raised — the copy switches on it', async () => {
    const source: TrackSource = {
      async fetch() {
        throw new ImportUrlError(
          'store-quota',
          'audio store quota exceeded — raise LOUPE_MAX_AUDIO_STORE_MB'
        )
      }
    }
    const result = await importFromUrl({ url: YOUTUBE_URL }, { source })
    expect(result).toEqual({
      ok: false,
      code: 'store-quota',
      detail: 'audio store quota exceeded — raise LOUPE_MAX_AUDIO_STORE_MB'
    })
  })

  it('folds an untyped throw into the unknown code, detail preserved', async () => {
    const source: TrackSource = {
      async fetch() {
        throw new Error('network down')
      }
    }
    const result = await importFromUrl({ url: YOUTUBE_URL }, { source })
    expect(result).toEqual({
      ok: false,
      code: 'unknown',
      detail: 'network down'
    })
  })
})
