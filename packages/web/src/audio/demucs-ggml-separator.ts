import type { StemSeparator } from '@app/core'
import type { GgmlWorkerMessage } from './demucs-ggml-model.ts'
import { createWorkerSeparator, dispatchStandard } from './worker-separator.ts'

/**
 * Driven adapter for `StemSeparator`: the demucs.cpp (GGML) WebAssembly engine.
 * Lighter and faster than the ONNX path (fp16 weights, no upcast/pre-packing,
 * single-threaded SIMD, no COOP/COEP). The worker streams its own
 * `PROGRESS_UPDATE` from the C++ during inference; lifecycle is shared.
 */
export function createGgmlSeparator(): StemSeparator {
  return createWorkerSeparator(
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
    }
  )
}
