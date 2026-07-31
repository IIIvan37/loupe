import type { DecodedAudio, SeparatedStem } from '@app/core'
import { useAtomValue } from 'jotai'
import { useCallback } from 'react'
import type { ChordDetection } from '../../lead-sheet/use-chord-detection.ts'
import type { StructureDetection } from '../../markers/use-structure-detection.ts'
import type { Mixer } from '../../mixer/use-mixer.ts'
import { separationGateReasonAtom } from '../../separation/separation-atoms.ts'
import { tempoGateReasonAtom } from '../../tempo/tempo-atoms.ts'
import { useRunTempoDetection } from '../../tempo/use-run-tempo-detection.ts'

interface ResumeFlows {
  readonly structureDetection: StructureDetection
  readonly chordDetection: ChordDetection
  readonly separateAndLoad: (
    audio: DecodedAudio | undefined
  ) => Promise<readonly SeparatedStem[] | undefined>
  readonly loadedAudio: DecodedAudio | undefined
  /** The mix a replayed detection seats its click into — the shell stack's
   * instance (the engine seam, same idiom as `MetronomeDeps`). */
  readonly mixer: Mixer
  /** A separation holds the mixer — the replayed click must not clobber it. */
  readonly separationOwnsMix: boolean
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
    separateAndLoad,
    loadedAudio,
    mixer,
    separationOwnsMix
  } = flows
  // The tempo's and separation's gate reasons are feature-owned now (ADR
  // 0010): read them off their atoms instead of receiving whole hook bags.
  const tempoGateReason = useAtomValue(tempoGateReasonAtom)
  const separationGateReason = useAtomValue(separationGateReasonAtom)
  // The replayed detection is the feature's own flow (ADR 0010), derived
  // here — the same detect → seat-the-click run the panel's retry fires.
  const runTempoDetection = useRunTempoDetection({ mixer, separationOwnsMix })
  return useCallback(() => {
    if (structureDetection.gateReason !== undefined) {
      void structureDetection.detect()
    }
    if (chordDetection.gateReason !== undefined) {
      void chordDetection.detect()
    }
    if (tempoGateReason !== undefined && loadedAudio) {
      runTempoDetection(loadedAudio)
    }
    if (separationGateReason !== undefined) {
      void separateAndLoad(loadedAudio)
    }
  }, [
    structureDetection,
    chordDetection,
    tempoGateReason,
    runTempoDetection,
    separationGateReason,
    separateAndLoad,
    loadedAudio
  ])
}
