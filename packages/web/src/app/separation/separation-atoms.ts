import { atom } from 'jotai'
import type { MintFailureReason } from '../../auth/auth-port.ts'

/**
 * The separation's view state, owned by this feature (ADR 0010) — declared
 * here, not in the shell, so a coordination hook reads it without a prop being
 * threaded. Only the field a foreign feature reads on its own lives here; the
 * rest of the separation state stays in `useSeparation` until a consumer pulls
 * it out. Nothing decides anything in this file: every transition stays in
 * `useSeparation` — the ADR's anti-erosion guard.
 */

/**
 * Why the offload gate blocked the last run (M1.3) — a web-auth concern the
 * shell opens the account menu on. Read on its own by the gated-analysis
 * replay, which no longer needs the whole separation bag to see it.
 */
export const separationGateReasonAtom = atom<MintFailureReason | undefined>(
  undefined
)
