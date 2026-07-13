import type { StructureDetector } from '@app/core'
import { ANALYSIS_URL } from './analysis-endpoint.ts'
import { cachedAnalysisToken } from './analysis-token.ts'
import { createHttpStructureDetector } from './http-structure-detector.ts'

/**
 * Build the `StructureDetector` adapter. Structure estimation runs on the GPU
 * inference endpoint (`ANALYSIS_URL`): the Modal offload when configured
 * (`VITE_STRUCTURE_URL`), else the local server. The bearer is the short-lived
 * token the analysis gate minted just before (read per upload, so a fresh one
 * is used); undefined on the local path → no `Authorization`.
 */
export function createStructureDetector(): StructureDetector {
  return createHttpStructureDetector(ANALYSIS_URL, () =>
    Promise.resolve(cachedAnalysisToken())
  )
}
