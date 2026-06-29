import type { StemSeparator } from '@app/core'
import type { GgmlWorkerMessage, StereoStem } from './demucs-ggml-model.ts'
import { toStereo44100 } from './resample.ts'
import { toSeparatedStems } from './stem-layout.ts'

function spawnWorker(): Worker {
  return new Worker(new URL('./demucs-ggml-worker.ts', import.meta.url), {
    type: 'module'
  })
}

/**
 * Driven adapter for `StemSeparator`: the demucs.cpp (GGML) WebAssembly engine.
 * Resamples the loaded PCM to stereo 44.1 kHz on the main thread, then runs
 * htdemucs in an off-main-thread worker. Lighter and faster than the ONNX path
 * (fp16 weights, no upcast/pre-packing, single-threaded SIMD, no COOP/COEP). One
 * run at a time — a new separation terminates any in-flight worker. Built lazily,
 * so constructing the adapter is free (tests inject a stub instead).
 */
export function createGgmlSeparator(): StemSeparator {
  let active: Worker | undefined

  return {
    async separate(audio, onProgress) {
      const { left, right } = await toStereo44100(audio)

      active?.terminate()
      const worker = spawnWorker()
      active = worker

      try {
        const stems = await new Promise<ReadonlyArray<StereoStem>>(
          (resolve, reject) => {
            worker.onmessage = (event: MessageEvent<GgmlWorkerMessage>) => {
              const message = event.data
              if ('msg' in message) {
                // Progress posted straight from the C++ during inference.
                if (message.msg === 'PROGRESS_UPDATE') {
                  onProgress({ phase: 'separating', fraction: message.data })
                }
                return
              }
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
          }
        )

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
