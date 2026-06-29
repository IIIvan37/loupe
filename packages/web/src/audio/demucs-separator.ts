import type { StemSeparator } from '@app/core'
import type { WorkerMessage } from './demucs-model.ts'
import { createWorkerSeparator, dispatchStandard } from './worker-separator.ts'

/**
 * Driven adapter for `StemSeparator`: htdemucs via onnxruntime-web in an
 * off-main-thread worker (single-threaded wasm SIMD). Kept as a selectable
 * alternative to the default demucs.cpp engine; lifecycle is shared.
 */
export function createDemucsSeparator(): StemSeparator {
  return createWorkerSeparator(
    () =>
      new Worker(new URL('./demucs-worker.ts', import.meta.url), {
        type: 'module'
      }),
    (data, resolve, reject, onProgress) =>
      dispatchStandard(data as WorkerMessage, resolve, reject, onProgress)
  )
}
