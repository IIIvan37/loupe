import type {
  ManualTempo,
  TempoAnalysis,
  TempoDetectionErrorCode
} from '@app/core'
import { atom } from 'jotai'
import type { MintFailureReason } from '../../auth/auth-port.ts'

/**
 * The tempo's view state, owned by this feature (ADR 0010) — declared here, not
 * in the shell, so every consumer (regions, orchestrators) sees the same
 * session tempo without a prop being threaded. Nothing decides anything in this
 * file: every transition stays in `useTempo`, which calls the core's use-cases
 * — the ADR's anti-erosion guard.
 */

/** The detected/seated tempo + beat grid, or undefined until a run succeeds. */
export const tempoAnalysisAtom = atom<TempoAnalysis | undefined>(undefined)

/** Whether a detection is in flight (drives the busy button). */
export const tempoDetectingAtom = atom(false)

/** Whether the last run was cancelled (X.2): not a failure — no error — but
 * not a dead end either, the row keeps an idle « Détecter » face. */
export const tempoCancelledAtom = atom(false)

/** Why the last detection failed — a code the panel maps to translated copy. */
export const tempoErrorAtom = atom<TempoDetectionErrorCode | undefined>(
  undefined
)

/** How far the tempo has been folded from the detection: ±2, 0 when fresh. */
export const tempoOctaveShiftAtom = atom(0)

/** The user-set tempo override (typed, tapped or phase-aligned), or undefined
 * while the analysis is the untouched detection. */
export const manualTempoAtom = atom<ManualTempo | undefined>(undefined)

/**
 * The session's single detection run — monotonic supersede token + in-flight
 * abort controller. One run exists per session whichever `useTempo` instance
 * started it: the analyser row's cancel must abort the detect the shell fired.
 * A read-only atom whose init runs once per store keeps tests isolated; the
 * box is mutated in place by `useTempo` (never rendered, so no write-atom).
 * Internal to `useTempo` — no other module may touch it.
 */
export const tempoRunAtom = atom(() => ({
  runId: 0,
  controller: undefined as AbortController | undefined
}))

/**
 * Why the detection was BLOCKED before it ran (offload only, M1.1) — a web-auth
 * concern the shell opens the account menu on. Read on its own by the gated-
 * analysis replay, which no longer needs the whole tempo bag to see it.
 */
export const tempoGateReasonAtom = atom<MintFailureReason | undefined>(
  undefined
)

/**
 * Whether a count-in is sounding (the transport is about to start) — the
 * regions render « playing » during the count; only `useCountIn` writes it.
 */
export const countingInAtom = atom(false)

/**
 * Whether a metronome click is seated in the mix — session state, not an
 * instance's (ADR 0010): the shell's metronome and a coordination hook's own
 * instance must agree on it, whichever one seated the click.
 */
export const metronomeEnabledAtom = atom(false)
