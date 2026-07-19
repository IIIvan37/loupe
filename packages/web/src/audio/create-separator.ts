import type { StemSeparator } from '@app/core'
import { analysisUrl } from './analysis-endpoint.ts'
import { cachedAnalysisToken } from './analysis-token.ts'
import { createHttpSeparator } from './http-separator.ts'

/**
 * Build the `StemSeparator` adapter. Separation runs on the Modal analysis
 * service (`analysisUrl()`, mandatory — offload-only). The bearer is the
 * short-lived token the analysis gate minted just before.
 */
export function createSeparator(): StemSeparator {
  return createHttpSeparator(analysisUrl(), () =>
    Promise.resolve(cachedAnalysisToken())
  )
}
