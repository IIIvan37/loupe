// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { vi } from 'vitest'
import { useServerHealth } from './use-server-health.ts'

/** A fetch stub answering `/health` with the given body (or failing). */
function healthFetch(
  device: string | null | 'unreachable'
): ReturnType<typeof vi.fn> {
  return vi.fn(async () => {
    if (device === 'unreachable') {
      throw new TypeError('fetch failed')
    }
    return {
      ok: true,
      json: async () => ({ status: 'ok', model: 'htdemucs', device })
    } as Response
  })
}

function renderHealth(fetchImpl: typeof fetch) {
  return renderHook(() =>
    useServerHealth({ baseUrl: 'http://test:8000', fetchImpl })
  )
}

describe('useServerHealth', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts checking, then reports ready when the server has a device', async () => {
    const fetchImpl = healthFetch('cuda') as unknown as typeof fetch
    const { result } = renderHealth(fetchImpl)

    expect(result.current).toBe('checking')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current).toBe('ready')
    expect(fetchImpl).toHaveBeenCalledWith('http://test:8000/health')
  })

  it('reports a healthy server without a separation device as degraded', async () => {
    const { result } = renderHealth(
      healthFetch(null) as unknown as typeof fetch
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current).toBe('no-separation')
  })

  it('reports offline when the probe cannot reach the server', async () => {
    const { result } = renderHealth(
      healthFetch('unreachable') as unknown as typeof fetch
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current).toBe('offline')
  })

  it('reports offline on a non-2xx answer', async () => {
    const fetchImpl = vi.fn(
      async () => ({ ok: false }) as Response
    ) as unknown as typeof fetch
    const { result } = renderHealth(fetchImpl)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current).toBe('offline')
  })

  it('re-probes every 30 s and picks up a server that came online', async () => {
    let device: string | null | 'unreachable' = 'unreachable'
    const fetchImpl = vi.fn(async () => {
      if (device === 'unreachable') {
        throw new TypeError('fetch failed')
      }
      return { ok: true, json: async () => ({ device }) } as Response
    }) as unknown as typeof fetch
    const { result } = renderHealth(fetchImpl)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current).toBe('offline')

    device = 'cpu'
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(result.current).toBe('ready')
  })

  it('stops polling once unmounted', async () => {
    const fetchImpl = healthFetch('cuda')
    const { unmount } = renderHealth(fetchImpl as unknown as typeof fetch)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    unmount()
    fetchImpl.mockClear()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000)
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
