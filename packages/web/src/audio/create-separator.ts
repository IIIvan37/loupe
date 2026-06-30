import type { StemSeparator } from '@app/core'
import { createGgmlSeparator } from './demucs-ggml-separator.ts'
import { createDemucsSeparator } from './demucs-separator.ts'
import { createHttpSeparator } from './http-separator.ts'

/**
 * Which separation engine to drive — all implement the same pure `StemSeparator`
 * port:
 * - `http`: a local server running a full Demucs (PyTorch, GPU-capable). Best
 *   quality and speed; needs `VITE_SEPARATOR_URL` to point at the backend.
 * - `ggml`: demucs.cpp WebAssembly (fp16, single-threaded SIMD) — in-browser,
 *   lighter/faster and CPU-only.
 * - `onnx`: htdemucs via onnxruntime-web — the original adapter, kept as an
 *   alternative (heavier; OOMs near the wasm32 ceiling on some machines).
 */
export type SeparatorEngine = 'http' | 'ggml' | 'onnx'

/** Base URL of the separation server, when the `http` engine is in use. */
const SEPARATOR_URL =
  import.meta.env.VITE_SEPARATOR_URL ?? 'http://localhost:8000'

export function createSeparator(
  engine: SeparatorEngine = 'http'
): StemSeparator {
  switch (engine) {
    case 'http':
      return createHttpSeparator(SEPARATOR_URL)
    case 'onnx':
      return createDemucsSeparator()
    default:
      return createGgmlSeparator()
  }
}
