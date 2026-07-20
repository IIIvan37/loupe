import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import type { AuthPort, MintFailureReason } from '../../auth/auth-port.ts'
import { AccountMenu } from './account-menu.tsx'

/** Each blocked-analysis reason mapped to its account-menu prompt — a
 * module-level `msg` map so the extractor sees the ids (a `t` passed as a
 * plain parameter is invisible to the macro). */
const GATE_NOTICES: Readonly<Record<MintFailureReason, MessageDescriptor>> = {
  'sign-in-required': msg({
    id: 'account.gate-sign-in',
    message: 'Se connecter pour lancer une analyse.'
  }),
  'not-a-beta-member': msg({
    id: 'account.gate-beta',
    message: 'Entrer un code beta pour accéder aux analyses.'
  }),
  'quota-exceeded': msg({
    id: 'account.gate-quota',
    // Actionable, not just descriptive: name the reset (the `usage` window
    // is monthly by contract) and what stays usable meanwhile.
    message:
      'Quota d’analyses du mois atteint — il se réinitialise le 1ᵉʳ du mois. Lecture, boucles et grille restent utilisables.'
  }),
  error: msg({
    id: 'account.gate-error',
    message: 'Analyse indisponible — réessayer.'
  })
}

/**
 * The header's account slot: the `AccountMenu` plus the glue that pops it open
 * with the right message when an analysis is blocked at the gate. The shell
 * feeds it one gate reason PER analysis flow (structure, tempo, chords —
 * M1.1); a fresh reason on any flow opens the menu (sign-in / redeem / quota)
 * so the user can act without hunting for the button. The comparison is per
 * flow: two flows blocked one after the other for the SAME reason each pop
 * the menu — a single combined value would read the second as unchanged.
 */
export function AccountMenuSlot({
  auth,
  gateReasons,
  onResumeAfterSignIn
}: {
  readonly auth: AuthPort
  readonly gateReasons: readonly (MintFailureReason | undefined)[]
  /** Replay the gate-blocked analysis once the user signs in (AK.1). A no-op
   * when nothing was blocked (the shell only re-runs flows still gated). */
  readonly onResumeAfterSignIn?: (() => void) | undefined
}) {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  // What the open notice speaks for — the flow whose fresh reason opened the
  // menu last. It only shows while that reason is still current (the owning
  // hook clears it on the next run), mirroring the pre-M1.1 behaviour.
  const [noticeReason, setNoticeReason] = useState<MintFailureReason>()

  // Open on a fresh gate reason (prev-prop idiom — no effect, no stale frame).
  const [seenReasons, setSeenReasons] = useState(gateReasons)
  if (gateReasons.some((reason, i) => reason !== seenReasons[i])) {
    const fresh = gateReasons.find(
      (reason, i) => reason !== undefined && reason !== seenReasons[i]
    )
    setSeenReasons(gateReasons)
    if (fresh !== undefined) {
      setNoticeReason(fresh)
      setOpen(true)
    }
  }

  const notice =
    open && noticeReason !== undefined && gateReasons.includes(noticeReason)
      ? t(GATE_NOTICES[noticeReason])
      : undefined

  return (
    <AccountMenu
      auth={auth}
      open={open}
      onOpenChange={setOpen}
      notice={notice}
      onSignedIn={onResumeAfterSignIn}
    />
  )
}
