import {
  initialSeparation,
  type SeparatedStem,
  type SeparationState
} from '@app/core'
import { atom } from 'jotai'
import type { MintFailureReason } from '../../auth/auth-port.ts'

/**
 * The separation's view state, owned by this feature (ADR 0010) — declared
 * here, not in the shell, so every consumer (regions, orchestrators) sees the
 * same session separation without a prop being threaded. Nothing decides
 * anything in this file: every transition stays in `useSeparation`, which
 * dispatches to the core's `separationReducer` — the ADR's anti-erosion guard.
 */

/** What the feature remembers of each separated stem — its identity, never its
 * PCM (the playback engine's buffers are the PCM's only custodian). */
export type StemDescriptor = Pick<SeparatedStem, 'id' | 'label'>

/** The separation state machine's current state (idle → analysing → ready). */
export const separationStateAtom = atom<SeparationState>(initialSeparation)

/** Which stems the last committed run produced — identities only. */
export const separationDescriptorsAtom = atom<readonly StemDescriptor[]>([])

/** Why the last export did not happen (translated) — cleared by the next one. */
export const separationExportErrorAtom = atom<string | undefined>(undefined)

/**
 * The session's single separation run — monotonic supersede token + in-flight
 * abort controller. One run exists per session whichever `useSeparation`
 * instance started it: the analyser row's cancel must abort the run the shell
 * fired. A read-only atom whose init runs once per store keeps tests isolated;
 * the box is mutated in place by `useSeparation` (never rendered, so no
 * write-atom). Internal to `useSeparation` — no other module may touch it.
 */
export const separationRunAtom = atom(() => ({
  runId: 0,
  controller: undefined as AbortController | undefined
}))

/**
 * Why the offload gate blocked the last run (M1.3) — a web-auth concern the
 * shell opens the account menu on. Read on its own by the gated-analysis
 * replay, which no longer needs the whole separation bag to see it.
 */
export const separationGateReasonAtom = atom<MintFailureReason | undefined>(
  undefined
)
