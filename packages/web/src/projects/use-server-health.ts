import { useEffect, useState } from 'react'
import { SERVER_URL } from './server-url.ts'

/** What the header status dot reports about the local server. */
export type ServerHealth =
  /** No probe has answered yet — show nothing rather than a guess. */
  | 'checking'
  /** `/health` did not answer: the server is not running. */
  | 'offline'
  /** The server answers but reports `device: null` — separation unavailable. */
  | 'no-separation'
  /** The server answers with a compute device — everything is available. */
  | 'ready'

interface UseServerHealthOptions {
  readonly baseUrl?: string | undefined
  readonly intervalMs?: number | undefined
  /** Injected in tests; defaults to the real global fetch. */
  readonly fetchImpl?: typeof fetch | undefined
}

const POLL_INTERVAL_MS = 30_000

/** One probe of `/health`, folded into the three reportable states. */
async function probe(
  fetchImpl: typeof fetch,
  baseUrl: string
): Promise<ServerHealth> {
  try {
    const response = await fetchImpl(`${baseUrl}/health`)
    if (!response.ok) {
      return 'offline'
    }
    const body = (await response.json()) as { device?: string | null }
    return body.device ? 'ready' : 'no-separation'
  } catch {
    return 'offline'
  }
}

/**
 * Smart hook polling the local server's `/health` on mount and every 30 s, so
 * the header can tell "server down" apart from "up but no separation engine".
 */
export function useServerHealth(
  options: UseServerHealthOptions = {}
): ServerHealth {
  const { baseUrl = SERVER_URL, intervalMs = POLL_INTERVAL_MS } = options
  const fetchImpl = options.fetchImpl
  const [health, setHealth] = useState<ServerHealth>('checking')

  useEffect(() => {
    const doFetch = fetchImpl ?? fetch
    let disposed = false
    async function check(): Promise<void> {
      const next = await probe(doFetch, baseUrl)
      if (!disposed) {
        setHealth(next)
      }
    }
    void check()
    const timer = setInterval(() => void check(), intervalMs)
    return () => {
      disposed = true
      clearInterval(timer)
    }
  }, [baseUrl, intervalMs, fetchImpl])

  return health
}
