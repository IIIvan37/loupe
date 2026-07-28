import type { TempoAnalysis } from '@app/core'
import { atom } from 'jotai'
import type { MintFailureReason } from '../../auth/auth-port.ts'

/**
 * The tempo's view state, owned by this feature (ADR 0010) — declared here, not
 * in the shell, so a coordination hook reads it without a prop being threaded.
 * Only the two fields a foreign feature reads on their own live here; the rest
 * of the tempo state stays in `useTempo` until a consumer pulls it out. Nothing
 * decides anything in this file: every transition stays in `useTempo`, which
 * calls the core's use-cases — the ADR's anti-erosion guard.
 */

/** The detected/seated tempo + beat grid, or undefined until a run succeeds. */
export const tempoAnalysisAtom = atom<TempoAnalysis | undefined>(undefined)

/**
 * Why the detection was BLOCKED before it ran (offload only, M1.1) — a web-auth
 * concern the shell opens the account menu on. Read on its own by the gated-
 * analysis replay, which no longer needs the whole tempo bag to see it.
 */
export const tempoGateReasonAtom = atom<MintFailureReason | undefined>(
  undefined
)
