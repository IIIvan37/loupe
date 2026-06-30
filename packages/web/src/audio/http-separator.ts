import type {
  DecodedAudio,
  SeparatedStem,
  SeparationPhase,
  SeparationProgress,
  StemSeparator
} from '@app/core'
import { decodeWav, encodeWav } from '@app/core'

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

/** Yield decoded NDJSON lines from a streaming response body. */
async function* readEvents(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<SeparationEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    // Stream reads are inherently sequential — each chunk must be awaited before
    // the next, so this cannot be parallelised.
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const lines = buffer.split('\n')
    // The last element is the trailing partial line; keep it for the next chunk.
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed) {
        yield JSON.parse(trimmed) as SeparationEvent
      }
    }
    if (done) {
      const tail = buffer.trim()
      if (tail) {
        yield JSON.parse(tail) as SeparationEvent
      }
      return
    }
  }
}

async function fetchStem(
  baseUrl: string,
  stem: { id: string; label: string; url: string }
): Promise<SeparatedStem> {
  const response = await fetch(new URL(stem.url, baseUrl).toString())
  if (!response.ok) {
    throw new Error(`stem ${stem.id} failed: HTTP ${response.status}`)
  }
  const audio: DecodedAudio = decodeWav(await response.arrayBuffer())
  return { id: stem.id, label: stem.label, audio }
}

/**
 * Driven adapter for `StemSeparator`: offloads separation to a local server that
 * runs a full Demucs model (PyTorch, GPU-capable) — far beyond what the browser's
 * WASM engines can do. The mix is uploaded as a WAV; the server streams NDJSON
 * progress, then a `done` event listing each stem's WAV URL, which we fetch and
 * decode back into PCM. The pure core never knows separation happened off-device.
 */
export function createHttpSeparator(baseUrl: string): StemSeparator {
  return {
    async separate(
      audio: DecodedAudio,
      onProgress: (progress: SeparationProgress) => void
    ): Promise<readonly SeparatedStem[]> {
      const wav = encodeWav(audio.channels, audio.sampleRate)
      const response = await fetch(`${baseUrl}/separate`, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: wav
      })
      if (!response.ok || !response.body) {
        throw new Error(`separation request failed: HTTP ${response.status}`)
      }

      let done: Extract<SeparationEvent, { type: 'done' }> | undefined
      for await (const event of readEvents(response.body)) {
        if (event.type === 'progress') {
          onProgress({ phase: event.phase, fraction: event.fraction })
        } else if (event.type === 'error') {
          throw new Error(event.message)
        } else {
          done = event
        }
      }
      if (!done) {
        throw new Error('separation ended without a result')
      }

      return Promise.all(done.stems.map((stem) => fetchStem(baseUrl, stem)))
    }
  }
}
