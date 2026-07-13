import { useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import type { AuthPort, MintFailureReason } from '../../auth/auth-port.ts'
import { AccountMenu } from './account-menu.tsx'

/**
 * The header's account slot: the `AccountMenu` plus the glue that pops it open
 * with the right message when an analysis is blocked at the gate. The shell
 * feeds it the structure detection's `gateReason`; a new reason opens the menu
 * (sign-in / redeem / quota) so the user can act without hunting for the button.
 */
export function AccountMenuSlot({
  auth,
  gateReason
}: {
  readonly auth: AuthPort
  readonly gateReason: MintFailureReason | undefined
}) {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)

  // Open on a fresh gate reason (prev-prop idiom — no effect, no stale frame).
  const [seenReason, setSeenReason] = useState(gateReason)
  if (gateReason !== seenReason) {
    setSeenReason(gateReason)
    if (gateReason !== undefined) {
      setOpen(true)
    }
  }

  const notice =
    open && gateReason !== undefined ? gateNotice(t, gateReason) : undefined

  return (
    <AccountMenu
      auth={auth}
      open={open}
      onOpenChange={setOpen}
      notice={notice}
    />
  )
}

/** Map a blocked-analysis reason to its account-menu prompt. */
function gateNotice(
  t: ReturnType<typeof useLingui>['t'],
  reason: MintFailureReason
): string {
  switch (reason) {
    case 'sign-in-required':
      return t({
        id: 'account.gate-sign-in',
        message: 'Se connecter pour lancer une analyse.'
      })
    case 'not-a-beta-member':
      return t({
        id: 'account.gate-beta',
        message: 'Entrer un code beta pour accéder aux analyses.'
      })
    case 'quota-exceeded':
      return t({
        id: 'account.gate-quota',
        message: 'Quota d’analyses du mois atteint.'
      })
    default:
      return t({
        id: 'account.gate-error',
        message: 'Analyse indisponible — réessayer.'
      })
  }
}
