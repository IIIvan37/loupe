// @vitest-environment jsdom
import type { TrackSource } from '@app/core'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useImportFromUrl } from './use-import-from-url.ts'

const YT = 'https://youtu.be/abc'

/** A source that resolves with the given metadata, reporting one progress tick. */
function okSource(): TrackSource {
  return {
    fetch: async (_url, onProgress) => {
      onProgress({ phase: 'transcoding', fraction: 1 })
      return {
        bytes: new Uint8Array([1, 2, 3]).buffer,
        metadata: { title: 'Un morceau' }
      }
    }
  }
}

describe('useImportFromUrl', () => {
  it('hands the fetched bytes + metadata to onImported', async () => {
    const onImported = vi.fn()
    const { result } = renderHook(() =>
      useImportFromUrl(onImported, okSource())
    )

    act(() => result.current.submit(YT))

    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1))
    const [bytes, metadata] = onImported.mock.calls[0] ?? []
    expect(new Uint8Array(bytes as ArrayBuffer)).toEqual(
      new Uint8Array([1, 2, 3])
    )
    expect(metadata).toEqual({ title: 'Un morceau' })
    // Running clears and progress resets once it lands.
    expect(result.current.running).toBe(false)
    expect(result.current.progress).toBeUndefined()
  })

  it('rejects an unsupported URL without calling the source', async () => {
    const fetch = vi.fn()
    const onImported = vi.fn()
    const { result } = renderHook(() => useImportFromUrl(onImported, { fetch }))

    act(() => result.current.submit('https://example.com/x'))

    await waitFor(() => expect(result.current.error).toMatch(/example\.com/))
    expect(fetch).not.toHaveBeenCalled()
    expect(onImported).not.toHaveBeenCalled()
  })

  it('surfaces a download failure and clears it on dismiss', async () => {
    const source: TrackSource = {
      fetch: async () => {
        throw new Error('réseau coupé')
      }
    }
    const { result } = renderHook(() => useImportFromUrl(vi.fn(), source))

    act(() => result.current.submit(YT))
    await waitFor(() => expect(result.current.error).toBe('réseau coupé'))

    act(() => result.current.dismissError())
    expect(result.current.error).toBeUndefined()
  })

  it('ignores a second submit while one is already running', async () => {
    const fetch = vi.fn(
      () =>
        new Promise<never>(() => {
          // never resolves — the run stays in flight
        })
    )
    const { result } = renderHook(() =>
      useImportFromUrl(vi.fn(), { fetch } as unknown as TrackSource)
    )

    act(() => result.current.submit(YT))
    await waitFor(() => expect(result.current.running).toBe(true))
    act(() => result.current.submit(YT))

    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
