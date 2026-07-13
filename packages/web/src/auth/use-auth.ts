import { useCallback, useEffect, useState } from 'react'
import { clearAnalysisToken, onAnalysisUsage } from '../audio/analysis-token.ts'
import type {
  AccountStatus,
  AuthPort,
  AuthState,
  RedeemResult
} from './auth-port.ts'

/** Where the magic-link step is: idle → sending → sent (check your email) / error. */
export type LinkPhase = 'idle' | 'sending' | 'sent' | 'error'
/** Where a code redemption is: idle → redeeming → its outcome. */
export type RedeemPhase = 'idle' | 'redeeming' | RedeemResult

export interface UseAuth {
  readonly state: AuthState
  /** Membership + quota, once signed in (undefined while signed out / loading). */
  readonly status: AccountStatus | undefined
  readonly linkPhase: LinkPhase
  readonly redeemPhase: RedeemPhase
  readonly sendMagicLink: (email: string) => void
  readonly signOut: () => void
  readonly redeemCode: (code: string) => void
}

/**
 * React binding over the `AuthPort`: tracks the session (live, via `onChange`),
 * loads the account snapshot when signed in, and drives the magic-link and
 * redeem flows with a small phase each so the popover can narrate them. Auth is
 * a web concern; this never touches the core. `auth` is injected (the app passes
 * `appAuth()`, a spec passes a fake).
 */
export function useAuth(auth: AuthPort): UseAuth {
  const [state, setState] = useState<AuthState>({ status: 'signed-out' })
  const [status, setStatus] = useState<AccountStatus | undefined>()
  const [linkPhase, setLinkPhase] = useState<LinkPhase>('idle')
  const [redeemPhase, setRedeemPhase] = useState<RedeemPhase>('idle')

  // Read the persisted session on mount, then follow sign-in/out live.
  useEffect(() => {
    let live = true
    void auth.currentState().then((s) => {
      if (live) {
        setState(s)
      }
    })
    const unsubscribe = auth.onChange((s) => {
      setState(s)
      setLinkPhase('idle')
    })
    return () => {
      live = false
      unsubscribe()
    }
  }, [auth])

  // Refresh the account snapshot whenever the signed-in identity changes.
  const signedInEmail =
    state.status === 'signed-in' ? state.session.email : undefined
  useEffect(() => {
    if (signedInEmail === undefined) {
      setStatus(undefined)
      return
    }
    let live = true
    void auth.accountStatus().then((s) => {
      if (live) {
        setStatus(s)
      }
    })
    return () => {
      live = false
    }
  }, [auth, signedInEmail])

  // A completed analysis spends a quota unit; reflect the fresh count the mint
  // returned, live, without waiting for a reload or a re-fetch.
  useEffect(() => {
    return onAnalysisUsage(({ used, quota }) => {
      setStatus((prev) =>
        prev ? { ...prev, used, quota } : { member: true, used, quota }
      )
    })
  }, [])

  const sendMagicLink = useCallback(
    (email: string) => {
      setLinkPhase('sending')
      auth.sendMagicLink(email).then(
        () => setLinkPhase('sent'),
        () => setLinkPhase('error')
      )
    },
    [auth]
  )

  const signOut = useCallback(() => {
    void auth.signOut().then(() => clearAnalysisToken())
  }, [auth])

  const redeemCode = useCallback(
    (code: string) => {
      setRedeemPhase('redeeming')
      void auth.redeemBetaCode(code).then((result) => {
        setRedeemPhase(result)
        if (result === 'redeemed') {
          void auth.accountStatus().then(setStatus)
        }
      })
    },
    [auth]
  )

  return {
    state,
    status,
    linkPhase,
    redeemPhase,
    sendMagicLink,
    signOut,
    redeemCode
  }
}
