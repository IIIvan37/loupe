import type { TempoDetector } from '@app/core'
import { ANALYSIS_URL } from './analysis-endpoint.ts'
import { cachedAnalysisToken } from './analysis-token.ts'
import { createHttpTempoDetector } from './http-tempo-detector.ts'

/**
 * Build the `TempoDetector` adapter. Beat tracking runs on the GPU inference
 * endpoint (`ANALYSIS_URL`): the Modal offload when configured
 * (`VITE_STRUCTURE_URL`), else the local server (M1.1 — same path as
 * structure). The bearer is the short-lived token the analysis gate minted
 * just before (read per upload, so a fresh one is used); undefined on the
 * local path → no `Authorization`.
 */
export function createTempoDetector(): TempoDetector {
  return createHttpTempoDetector(ANALYSIS_URL, () =>
    Promise.resolve(cachedAnalysisToken())
  )
}
