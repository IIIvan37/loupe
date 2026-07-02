import type { StemSeparator } from '@app/core'
import { SERVER_URL } from '../projects/server-url.ts'
import { createHttpSeparator } from './http-separator.ts'

/**
 * Build the `StemSeparator` adapter. Separation runs on a local **FastAPI +
 * Demucs** backend (PyTorch, GPU-capable) reached over HTTP — point it at the
 * server with `VITE_SEPARATOR_URL` (defaults to `http://localhost:8000`). The
 * earlier in-browser WASM engines (demucs.cpp GGML / onnxruntime-web) hit a
 * quality+speed wall and were removed.
 */
export function createSeparator(): StemSeparator {
  return createHttpSeparator(SERVER_URL)
}
