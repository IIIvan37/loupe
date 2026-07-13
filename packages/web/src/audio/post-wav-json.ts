import type { DecodedAudio } from '@app/core'
import { encodeWavMemo } from './encode-wav-memo.ts'

/**
 * A non-2xx answer, with the status kept machine-readable so an adapter can
 * discriminate the statuses it knows how to explain (503 = engine missing).
 */
class HttpStatusError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'HttpStatusError'
  }
}

/** `fetch` itself failed — server down, offline, bad URL. Never a response. */
class NetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NetworkError'
  }
}

/**
 * The transport failures every analysis endpoint shares, named after what the
 * user can act on. Each adapter translates them into its own port error in
 * one line — the interpretation (which status means what on this server)
 * lives here, once.
 */
export type TransportFailure =
  | 'engine-unavailable'
  | 'network'
  | 'timeout'
  | 'too-large'

/** The statuses this server answers deliberately, mapped to their meaning. */
const STATUS_FAILURES: Record<number, TransportFailure> = {
  503: 'engine-unavailable',
  504: 'timeout',
  413: 'too-large'
}

/**
 * Name the transport failure a `postWavForJson` throw represents, or
 * undefined when it is not one this server contract explains (those should
 * surface as the caller's "unknown" path, detail preserved).
 */
export function classifyTransportError(
  e: unknown
): TransportFailure | undefined {
  if (e instanceof HttpStatusError) {
    return STATUS_FAILURES[e.status]
  }
  return e instanceof NetworkError ? 'network' : undefined
}

/**
 * The POST-a-mix-WAV-get-JSON skeleton the analysis adapters share
 * (`/tempo`, `/chords`): encode the loaded PCM (memoised per audio, shared
 * with `/separate`), upload it, fail loudly on a non-2xx answer. Each
 * adapter keeps only its response-shape guard and mapping — a protocol
 * change (auth, abort, error detail) lands once here.
 */
export async function postWavForJson(
  baseUrl: string,
  path: string,
  audio: DecodedAudio,
  signal?: AbortSignal,
  /** A bearer token — sent as `Authorization` when the endpoint gates on it
   * (the Modal offload, J1). Omitted for the token-less local server. */
  token?: string
): Promise<unknown> {
  const wav = encodeWavMemo(audio)
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
        ...(token !== undefined && { Authorization: `Bearer ${token}` })
      },
      body: wav,
      signal: signal ?? null
    })
  } catch (e) {
    // Only the fetch call gets the network typing — a TypeError thrown by
    // the encoder or a response guard must not read as "server unreachable";
    // an abort surfaces as a DOMException, so it stays unclassified too.
    if (e instanceof TypeError) {
      throw new NetworkError(e.message)
    }
    throw e
  }
  if (!response.ok) {
    throw new HttpStatusError(
      response.status,
      `${path.slice(1)} request failed: HTTP ${response.status}`
    )
  }
  return response.json()
}
