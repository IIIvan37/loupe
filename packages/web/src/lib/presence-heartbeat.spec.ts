import { afterEach, beforeEach, vi } from 'vitest'
import {
  HEARTBEAT_INTERVAL_MS,
  startPresenceHeartbeat
} from './presence-heartbeat.ts'

describe('startPresenceHeartbeat', () => {
  const fetchSpy = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.useFakeTimers()
    fetchSpy.mockReset()
    fetchSpy.mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('posts a heartbeat to the serving origin at every interval', () => {
    startPresenceHeartbeat('http://127.0.0.1:6173')
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 3)
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(fetchSpy).toHaveBeenLastCalledWith(
      'http://127.0.0.1:6173/heartbeat',
      { method: 'POST' }
    )
  })

  it('survives a dead server — the next beat still fires', async () => {
    fetchSpy.mockRejectedValue(new TypeError('fetch failed'))
    startPresenceHeartbeat('http://127.0.0.1:6173')
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 2)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('stops beating once stopped', () => {
    const stop = startPresenceHeartbeat('http://127.0.0.1:6173')
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS)
    stop()
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 5)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
