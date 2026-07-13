import type { StructureDetector } from '@app/core'
import { SERVER_URL } from '../projects/server-url.ts'
import { createHttpStructureDetector } from './http-structure-detector.ts'

/**
 * Build the `StructureDetector` adapter. Structure estimation runs on the same
 * local server as separation (vendored SongFormer), reached over HTTP — point
 * it at the server with `VITE_SEPARATOR_URL` (defaults to `http://localhost:8000`).
 */
export function createStructureDetector(): StructureDetector {
  return createHttpStructureDetector(SERVER_URL)
}
