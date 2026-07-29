import type { DecodedAudio, SeparatedStem } from '@app/core'
import { useAtomValue } from 'jotai'
import { useCallback } from 'react'
import type { ChordDetection } from '../lead-sheet/use-chord-detection.ts'
import type { StructureDetection } from '../markers/use-structure-detection.ts'
import type { useSeparation } from '../separation/use-separation.ts'
import { tempoGateReasonAtom } from '../tempo/tempo-atoms.ts'
import type { useTempoDetection } from './use-tempo-detection.ts'

interface ResumeFlows {
  readonly structureDetection: StructureDetection
  readonly chordDetection: ChordDetection
  readonly tempoDetection: ReturnType<typeof useTempoDetection>
  readonly separation: ReturnType<typeof useSeparation>
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
    separation,
    separateAndLoad,
    loadedAudio
  } = flows
  // The tempo's gate reason is feature-owned now (ADR 0010): read it off the
  // atom instead of receiving the whole tempo bag as a prop.
  const tempoGateReason = useAtomValue(tempoGateReasonAtom)
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
    if (separation.gateReason !== undefined) {
      void separateAndLoad(loadedAudio)
    }
  }, [
    structureDetection,
    chordDetection,
    tempoGateReason,
    tempoDetection,
    separation,
    separateAndLoad,
    loadedAudio
  ])
}
