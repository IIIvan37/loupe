import type {
  DecodedAudio,
  SeparatedStem,
  SeparationPhase,
  SeparationProgress,
  StemSeparator
} from '@app/core'
import { decodeWav } from '@app/core'
import { encodeWavMemo } from './encode-wav-memo.ts'
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

async function fetchStem(
  baseUrl: string,
  stem: { id: string; label: string; url: string },
  signal?: AbortSignal
): Promise<SeparatedStem> {
  const response = await fetch(new URL(stem.url, baseUrl).toString(), {
    signal: signal ?? null
  })
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
      onProgress: (progress: SeparationProgress) => void,
      signal?: AbortSignal
    ): Promise<readonly SeparatedStem[]> {
      const wav = encodeWavMemo(audio)
      // The signal covers the whole run: aborting also tears down the NDJSON
      // stream (its reader rejects) and any in-flight stem fetch below.
      const response = await fetch(`${baseUrl}/separate`, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: wav,
        signal: signal ?? null
      })
      if (!response.ok || !response.body) {
        throw new Error(`separation request failed: HTTP ${response.status}`)
      }

      const done = await streamNdjson<SeparationEvent>(response.body, (event) =>
        onProgress({ phase: event.phase, fraction: event.fraction })
      )

      return Promise.all(
        done.stems.map((stem) => fetchStem(baseUrl, stem, signal))
      )
    }
  }
}
