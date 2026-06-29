import type { StemSeparator } from '@app/core'
import type { WorkerMessage } from './demucs-model.ts'
import { toStereo44100 } from './resample.ts'
import { toSeparatedStems } from './stem-layout.ts'

function spawnWorker(): Worker {
  return new Worker(new URL('./demucs-worker.ts', import.meta.url), {
    type: 'module'
  })
}

/**
 * Driven adapter for `StemSeparator`: the real Demucs WASM engine. It resamples
 * the loaded PCM to stereo 44.1 kHz on the main thread, then runs htdemucs in an
 * off-main-thread worker, streaming progress into the port's `onProgress`. One
 * run at a time — a new separation terminates any in-flight worker, bounding
 * memory. The worker is created lazily, so constructing the adapter is free
 * (tests inject a stub instead of touching wasm).
 */
export function createDemucsSeparator(): StemSeparator {
  let active: Worker | undefined

  return {
    async separate(audio, onProgress) {
      const { left, right } = await toStereo44100(audio)

      active?.terminate()
      const worker = spawnWorker()
      active = worker

      try {
        const stems = await new Promise<
          ReadonlyArray<{ left: Float32Array; right: Float32Array }>
        >((resolve, reject) => {
          worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
            const message = event.data
            if (message.type === 'progress') {
              onProgress({ phase: message.phase, fraction: message.fraction })
            } else if (message.type === 'done') {
              resolve(message.stems)
            } else {
              reject(new Error(message.message))
            }
          }
          worker.onerror = (event) =>
            reject(new Error(event.message || 'separation worker crashed'))
          worker.postMessage({ left, right }, [left.buffer, right.buffer])
        })

        return toSeparatedStems(stems)
      } finally {
        worker.terminate()
        if (active === worker) {
          active = undefined
        }
      }
    }
  }
}
