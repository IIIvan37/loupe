import type { ChordDetector } from '@app/core'
import { analysisUrl } from './analysis-endpoint.ts'
import { cachedAnalysisToken } from './analysis-token.ts'
import { createHttpChordDetector } from './http-chord-detector.ts'

/**
 * Build the `ChordDetector` adapter. Chord estimation runs on the Modal
 * analysis service (`analysisUrl()`, mandatory — offload-only). The bearer is
 * the short-lived token the analysis gate minted just before (read per upload,
 * so a fresh one is used).
 */
export function createChordDetector(): ChordDetector {
  return createHttpChordDetector(analysisUrl(), () =>
    Promise.resolve(cachedAnalysisToken())
  )
}
