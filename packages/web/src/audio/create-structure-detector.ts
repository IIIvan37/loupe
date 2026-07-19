import type { StructureDetector } from '@app/core'
import { analysisUrl } from './analysis-endpoint.ts'
import { cachedAnalysisToken } from './analysis-token.ts'
import { createHttpStructureDetector } from './http-structure-detector.ts'

/**
 * Build the `StructureDetector` adapter. Structure estimation runs on the Modal
 * analysis service (`analysisUrl()`, mandatory — offload-only). The bearer is
 * the short-lived token the analysis gate minted just before (read per upload,
 * so a fresh one is used).
 */
export function createStructureDetector(): StructureDetector {
  return createHttpStructureDetector(analysisUrl(), () =>
    Promise.resolve(cachedAnalysisToken())
  )
}
