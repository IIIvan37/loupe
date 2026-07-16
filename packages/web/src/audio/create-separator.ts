import type { StemSeparator } from '@app/core'
import { ANALYSIS_URL } from './analysis-endpoint.ts'
import { cachedAnalysisToken } from './analysis-token.ts'
import { createHttpSeparator } from './http-separator.ts'

/**
 * Build the `StemSeparator` adapter. Separation runs on the GPU inference
 * endpoint (`ANALYSIS_URL`): the Modal offload when configured
 * (`VITE_STRUCTURE_URL`), else the local FastAPI + Demucs server (M1.3 — same
 * path as the three detections). The bearer is the short-lived token the
 * analysis gate minted just before; undefined on the local path → no
 * `Authorization`.
 */
export function createSeparator(): StemSeparator {
  return createHttpSeparator(ANALYSIS_URL, () =>
    Promise.resolve(cachedAnalysisToken())
  )
}
