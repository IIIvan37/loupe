import type { ChordDetector } from '@app/core'
import { SERVER_URL } from '../projects/server-url.ts'
import { createHttpChordDetector } from './http-chord-detector.ts'

/**
 * Build the `ChordDetector` adapter. Chord estimation runs on the same local
 * server as separation (vendored BTC), reached over HTTP — point it at the
 * server with `VITE_SEPARATOR_URL` (defaults to `http://localhost:8000`).
 */
export function createChordDetector(): ChordDetector {
  return createHttpChordDetector(SERVER_URL)
}
