import type { TempoDetector } from '@app/core'
import { SERVER_URL } from '../projects/server-url.ts'
import { createHttpTempoDetector } from './http-tempo-detector.ts'

/**
 * Build the `TempoDetector` adapter. Beat tracking runs on the same local
 * server as separation (librosa), reached over HTTP — point it at the server
 * with `VITE_SEPARATOR_URL` (defaults to `http://localhost:8000`).
 */
export function createTempoDetector(): TempoDetector {
  return createHttpTempoDetector(SERVER_URL)
}
