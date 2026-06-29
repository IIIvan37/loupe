import type { StemSeparator } from '@app/core'
import { createGgmlSeparator } from './demucs-ggml-separator.ts'
import { createDemucsSeparator } from './demucs-separator.ts'

/**
 * Which client-side separation engine to drive — both implement the same pure
 * `StemSeparator` port:
 * - `ggml`: demucs.cpp WebAssembly (fp16, single-threaded SIMD) — the default,
 *   lighter/faster and CPU-only.
 * - `onnx`: htdemucs via onnxruntime-web — the original adapter, kept as an
 *   alternative (heavier; OOMs near the wasm32 ceiling on some machines).
 */
export type SeparatorEngine = 'ggml' | 'onnx'

export function createSeparator(
  engine: SeparatorEngine = 'ggml'
): StemSeparator {
  return engine === 'onnx' ? createDemucsSeparator() : createGgmlSeparator()
}
