import type { StructureDetector } from '@app/core'
import { ANALYSIS_URL, analysisToken } from './analysis-endpoint.ts'
import { createHttpStructureDetector } from './http-structure-detector.ts'

/**
 * Build the `StructureDetector` adapter. Structure estimation runs on the GPU
 * inference endpoint (`ANALYSIS_URL`): the Modal offload when configured
 * (`VITE_STRUCTURE_URL` + a runtime token), else the local server.
 */
export function createStructureDetector(): StructureDetector {
  return createHttpStructureDetector(ANALYSIS_URL, analysisToken())
}
