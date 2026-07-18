import type { DownloadProgress } from '@app/core'
import { describe, expect, it, vi } from 'vitest'
import {
  createTauriTrackSource,
  type TauriDownloadBridge,
  type TauriDownloadedTrack
} from './tauri-track-source.ts'

const wav = new TextEncoder().encode('wav-bytes')

function fakeBridge(
  over: Partial<TauriDownloadBridge> = {},
  done: Partial<TauriDownloadedTrack> = {}
) {
  const removed: string[] = []
  const bridge: TauriDownloadBridge = {
    downloadTrack: vi.fn(async (_url, onEvent) => {
      onEvent({ type: 'progress', phase: 'downloading', fraction: 0.5 })
      onEvent({ type: 'progress', phase: 'transcoding', fraction: 1 })
      return {
        relativePath: 'downloads/dl-1/abc.m4a',
        title: 'Song',
        durationSeconds: 249,
        uploader: 'Band',
        ...done
      }
    }),
    cancelDownload: vi.fn(async () => {}),
    readFile: vi.fn(async () => wav),
    removeDir: vi.fn(async (dir: string) => {
      removed.push(dir)
    }),
    ...over
  }
  return { bridge, removed }
}

describe('createTauriTrackSource', () => {
  it('streams progress, reads the file back and maps the metadata', async () => {
    const { bridge, removed } = fakeBridge()
    const seen: DownloadProgress[] = []

    const track = await createTauriTrackSource(bridge).fetch(
      'https://youtu.be/x',
      (p) => seen.push(p)
    )

    expect(seen).toEqual([
      { phase: 'downloading', fraction: 0.5 },
      { phase: 'transcoding', fraction: 1 }
    ])
    expect(new TextDecoder().decode(track.bytes)).toBe('wav-bytes')
    expect(track.metadata).toEqual({
      title: 'Song',
      durationSeconds: 249,
      artist: 'Band'
    })
    // The per-download temp dir is removed once the bytes are in memory.
    expect(removed).toEqual(['downloads/dl-1'])
  })

  it('omits absent metadata instead of writing null into the manifest', async () => {
    const { bridge } = fakeBridge({}, { durationSeconds: null, uploader: null })

    const track = await createTauriTrackSource(bridge).fetch(
      'https://youtu.be/x',
      () => {}
    )

    expect(track.metadata).toEqual({ title: 'Song' })
  })

  it('kills the child when the signal aborts mid-download', async () => {
    const { bridge } = fakeBridge({
      downloadTrack: vi.fn(() => new Promise<TauriDownloadedTrack>(() => {}))
    })
    const controller = new AbortController()

    const pending = createTauriTrackSource(bridge).fetch(
      'https://youtu.be/x',
      () => {},
      controller.signal
    )
    controller.abort()
    await Promise.resolve()

    expect(bridge.cancelDownload).toHaveBeenCalled()
    // The command never resolves here; the caller's run-token discards it.
    void pending
  })

  it('refuses to start on an already-aborted signal', async () => {
    const { bridge } = fakeBridge()
    const controller = new AbortController()
    controller.abort()

    await expect(
      createTauriTrackSource(bridge).fetch(
        'https://youtu.be/x',
        () => {},
        controller.signal
      )
    ).rejects.toThrow(/aborted/)
    expect(bridge.downloadTrack).not.toHaveBeenCalled()
  })

  it('still returns the track when the temp-dir cleanup fails', async () => {
    const { bridge } = fakeBridge({
      removeDir: vi.fn(async () => {
        throw new Error('locked')
      })
    })

    const track = await createTauriTrackSource(bridge).fetch(
      'https://youtu.be/x',
      () => {}
    )

    expect(track.metadata.title).toBe('Song')
  })

  it('propagates the command failure so the use-case reports it', async () => {
    const { bridge } = fakeBridge({
      downloadTrack: vi.fn(async () => {
        throw new Error('download timed out')
      })
    })

    await expect(
      createTauriTrackSource(bridge).fetch('https://youtu.be/x', () => {})
    ).rejects.toThrow('download timed out')
  })
})
