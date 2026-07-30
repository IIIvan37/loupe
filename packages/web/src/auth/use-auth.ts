import { useCallback, useEffect, useState } from 'react'
import { clearAnalysisToken, onAnalysisUsage } from './analysis-token.ts'
import type {
  AccountStatus,
  AuthPort,
  AuthState,
  RedeemResult
} from './auth-port.ts'

/** Where the magic-link step is: idle → sending → sent (check your email) / error. */
export type LinkPhase = 'idle' | 'sending' | 'sent' | 'error'
/** Where the OTP-code step is: idle → verifying → error (success flips the
 * session to signed-in via `onChange`, so there is no 'done' phase). */
export type VerifyPhase = 'idle' | 'verifying' | 'error'
/** Where a code redemption is: idle → redeeming → its outcome. */
export type RedeemPhase = 'idle' | 'redeeming' | RedeemResult

export interface UseAuth {
  readonly state: AuthState
  /** Membership + quota, once signed in (undefined while signed out / loading). */
  readonly status: AccountStatus | undefined
  readonly linkPhase: LinkPhase
  readonly verifyPhase: VerifyPhase
  readonly redeemPhase: RedeemPhase
  readonly sendMagicLink: (email: string) => void
  /** Verify the OTP code the user typed; success signs them in via `onChange`. */
  readonly verifyCode: (email: string, code: string) => void
  /** Return the magic-link step to idle — « Changer d'adresse » from the sent
   * state, showing the email field again (AK.1). */
  readonly resetLink: () => void
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
  const [verifyPhase, setVerifyPhase] = useState<VerifyPhase>('idle')
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
      setVerifyPhase('idle')
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
      setVerifyPhase('idle')
      auth.sendMagicLink(email).then(
        () => setLinkPhase('sent'),
        () => setLinkPhase('error')
      )
    },
    [auth]
  )

  const verifyCode = useCallback(
    (email: string, code: string) => {
      setVerifyPhase('verifying')
      // Success flips the session to signed-in through `onChange` (which also
      // clears this phase); only a failed code needs surfacing here.
      auth.verifyOtp(email, code).then(
        (ok) => setVerifyPhase(ok ? 'idle' : 'error'),
        () => setVerifyPhase('error')
      )
    },
    [auth]
  )

  const resetLink = useCallback(() => {
    setLinkPhase('idle')
    setVerifyPhase('idle')
  }, [])

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
    verifyPhase,
    redeemPhase,
    sendMagicLink,
    verifyCode,
    resetLink,
    signOut,
    redeemCode
  }
}
