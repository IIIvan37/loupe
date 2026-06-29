import type { StemSeparator } from '@app/core'
import {
  CHUNK_CONTEXT_SAMPLES,
  type GgmlWorkerMessage
} from './demucs-ggml-model.ts'
import { createParallelWorkerSeparator } from './parallel-worker-separator.ts'
import { dispatchStandard } from './worker-separator.ts'

/** Cap on parallel workers — each holds its own ~84 MB model copy, so bound memory. */
const MAX_WORKERS = 4

/** How many workers to fan out to: leave a core for the UI, capped for memory. */
function workerCount(): number {
  const cores = globalThis.navigator?.hardwareConcurrency ?? 1
  return Math.max(1, Math.min(cores - 1, MAX_WORKERS))
}

/**
 * Driven adapter for `StemSeparator`: the demucs.cpp (GGML) WebAssembly engine,
 * run data-parallel across N workers (each separates one overlapping chunk; the
 * results are blended by the core overlap-add). Lighter than the ONNX path (fp16,
 * single-threaded SIMD, no COOP/COEP) and ~N× faster on a multi-core machine. Each
 * worker streams its own `PROGRESS_UPDATE` from the C++; lifecycle is shared.
 */
export function createGgmlSeparator(): StemSeparator {
  return createParallelWorkerSeparator(
    () =>
      new Worker(new URL('./demucs-ggml-worker.ts', import.meta.url), {
        type: 'module'
      }),
    (data, resolve, reject, onProgress) => {
      const message = data as GgmlWorkerMessage
      if ('msg' in message) {
        // Progress posted straight from the C++ during inference (WASM_LOG ignored).
        if (message.msg === 'PROGRESS_UPDATE') {
          onProgress({ phase: 'separating', fraction: message.data })
        }
        return
      }
      dispatchStandard(message, resolve, reject, onProgress)
    },
    { workerCount, context: CHUNK_CONTEXT_SAMPLES }
  )
}
