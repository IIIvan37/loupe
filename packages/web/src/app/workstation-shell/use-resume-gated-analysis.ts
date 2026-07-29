import type { DecodedAudio, SeparatedStem } from '@app/core'
import { useAtomValue } from 'jotai'
import { useCallback } from 'react'
import type { ChordDetection } from '../lead-sheet/use-chord-detection.ts'
import type { StructureDetection } from '../markers/use-structure-detection.ts'
import { separationGateReasonAtom } from '../separation/separation-atoms.ts'
import { tempoGateReasonAtom } from '../tempo/tempo-atoms.ts'
import type { useTempoDetection } from './use-tempo-detection.ts'

interface ResumeFlows {
  readonly structureDetection: StructureDetection
  readonly chordDetection: ChordDetection
  readonly tempoDetection: ReturnType<typeof useTempoDetection>
  readonly separateAndLoad: (
    audio: DecodedAudio | undefined
  ) => Promise<readonly SeparatedStem[] | undefined>
  readonly loadedAudio: DecodedAudio | undefined
}

/**
 * After the user signs in (or redeems) from the gate-opened account menu,
 * replay whatever analysis was blocked at the gate — no re-click (AK.1). Only
 * flows still carrying a gate reason re-run; typically it is the one clicked.
 */
export function useResumeGatedAnalysis(flows: ResumeFlows): () => void {
  const {
    structureDetection,
    chordDetection,
    tempoDetection,
    separateAndLoad,
    loadedAudio
  } = flows
  // The tempo's and separation's gate reasons are feature-owned now (ADR
  // 0010): read them off their atoms instead of receiving whole hook bags.
  const tempoGateReason = useAtomValue(tempoGateReasonAtom)
  const separationGateReason = useAtomValue(separationGateReasonAtom)
  return useCallback(() => {
    if (structureDetection.gateReason !== undefined) {
      void structureDetection.detect()
    }
    if (chordDetection.gateReason !== undefined) {
      void chordDetection.detect()
    }
    if (tempoGateReason !== undefined) {
      tempoDetection.retry()
    }
    if (separationGateReason !== undefined) {
      void separateAndLoad(loadedAudio)
    }
  }, [
    structureDetection,
    chordDetection,
    tempoGateReason,
    tempoDetection,
    separationGateReason,
    separateAndLoad,
    loadedAudio
  ])
}
