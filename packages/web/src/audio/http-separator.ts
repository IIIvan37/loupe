import type {
  DecodedAudio,
  SeparatedStem,
  SeparationPhase,
  SeparationProgress,
  StemSeparator
} from '@app/core'
import { decodeWav, encodeWav } from '@app/core'
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

      const done = await streamNdjson<SeparationEvent>(response.body, (event) =>
        onProgress({ phase: event.phase, fraction: event.fraction })
      )

      return Promise.all(done.stems.map((stem) => fetchStem(baseUrl, stem)))
    }
  }
}
