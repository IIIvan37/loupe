import type {
  DecodedAudio,
  SeparatedStem,
  SeparationPhase,
  SeparationProgress,
  StemSeparator
} from '@app/core'
import { decodeWav, SeparationError } from '@app/core'
import { encodeWavMemo } from './encode-wav-memo.ts'
import { transportFailureOfStatus } from './post-wav-json.ts'
import { streamNdjson } from './read-ndjson.ts'

/** One NDJSON line the server streams during a separation. */
type SeparationEvent =
  | {
      readonly type: 'progress'
      readonly phase: SeparationPhase
      readonly fraction: number
    }
  | {
      readonly type: 'done'
      readonly stems: ReadonlyArray<{ id: string; label: string; url: string }>
    }
  | { readonly type: 'error'; readonly message: string }

function authHeaders(token: string | undefined): HeadersInit {
  return token === undefined ? {} : { Authorization: `Bearer ${token}` }
}

/**
 * `fetch` with the separation flow's error typing (M1.4, the N.1 contract):
 * a fetch-level failure is `network` (an abort's DOMException stays untyped —
 * a cancel is not a failure), a deliberate status maps through the shared
 * transport interpretation, anything else stays untyped → the `unknown` path.
 */
async function typedFetch(
  url: string,
  init: RequestInit,
  context: string
): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch (e) {
    if (e instanceof TypeError) {
      throw new SeparationError('network', e.message)
    }
    throw e
  }
  if (!response.ok) {
    const failure = transportFailureOfStatus(response.status)
    const detail = `${context} failed: HTTP ${response.status}`
    if (failure !== undefined) {
      throw new SeparationError(failure, detail)
    }
    throw new Error(detail)
  }
  return response
}

async function fetchStem(
  baseUrl: string,
  stem: { id: string; label: string; url: string },
  token: string | undefined,
  signal?: AbortSignal
): Promise<SeparatedStem> {
  const response = await typedFetch(
    new URL(stem.url, baseUrl).toString(),
    { headers: authHeaders(token), signal: signal ?? null },
    `stem ${stem.id}`
  )
  const audio: DecodedAudio = decodeWav(await response.arrayBuffer())
  return { id: stem.id, label: stem.label, audio }
}

/**
 * Driven adapter for `StemSeparator`: offloads separation to a server that
 * runs a full Demucs model (PyTorch, GPU-capable) — far beyond what the browser's
 * WASM engines can do. The mix is uploaded as a WAV; the server streams NDJSON
 * progress, then a `done` event listing each stem's WAV URL, which we fetch and
 * decode back into PCM. The pure core never knows separation happened off-device.
 */
export function createHttpSeparator(
  baseUrl: string,
  /** Resolves the bearer to send, or undefined for the token-less local server.
   * Read once per run — the SAME token covers the upload and the stem
   * downloads (the Modal gate covers `/stems` too, M1.3). */
  tokenProvider?: () => Promise<string | undefined>
): StemSeparator {
  return {
    async separate(
      audio: DecodedAudio,
      onProgress: (progress: SeparationProgress) => void,
      signal?: AbortSignal
    ): Promise<readonly SeparatedStem[]> {
      const token = tokenProvider ? await tokenProvider() : undefined
      const wav = encodeWavMemo(audio)
      // The signal covers the whole run: aborting also tears down the NDJSON
      // stream (its reader rejects) and any in-flight stem fetch below.
      const response = await typedFetch(
        `${baseUrl}/separate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'audio/wav', ...authHeaders(token) },
          body: wav,
          signal: signal ?? null
        },
        'separation request'
      )
      if (!response.body) {
        throw new Error('separation request failed: empty response body')
      }

      const done = await streamNdjson<SeparationEvent>(response.body, (event) =>
        onProgress({ phase: event.phase, fraction: event.fraction })
      )

      return Promise.all(
        done.stems.map((stem) => fetchStem(baseUrl, stem, token, signal))
      )
    }
  }
}
