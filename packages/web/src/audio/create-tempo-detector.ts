import type { TempoDetector } from '@app/core'
import { analysisUrl } from './analysis-endpoint.ts'
import { cachedAnalysisToken } from './analysis-token.ts'
import { createHttpTempoDetector } from './http-tempo-detector.ts'

/**
 * Build the `TempoDetector` adapter. Beat tracking runs on the Modal analysis
 * service (`analysisUrl()`, mandatory — offload-only). The bearer is the
 * short-lived token the analysis gate minted just before (read per upload, so
 * a fresh one is used).
 */
export function createTempoDetector(): TempoDetector {
  return createHttpTempoDetector(analysisUrl(), () =>
    Promise.resolve(cachedAnalysisToken())
  )
}
