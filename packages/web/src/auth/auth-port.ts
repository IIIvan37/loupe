/**
 * The auth surface the workstation needs, kept as a small web-local port so the
 * UI and the analysis-token gate depend on an interface, not on supabase-js
 * directly — and so tests inject a fake (mirroring how the shell fakes its
 * detector ports). Auth is an ADAPTER concern: none of this reaches the pure
 * core, whose `StructureDetector` stays agnostic about who is allowed to call.
 */

/** The signed-in identity the UI shows (just the email, for the account menu). */
export interface AuthSession {
  readonly email: string
}

export type AuthState =
  | { readonly status: 'signed-out' }
  | { readonly status: 'signed-in'; readonly session: AuthSession }

/**
 * Why a token mint did not yield a usable token — each maps to a distinct UI
 * response (prompt sign-in, prompt code redemption, show the quota message).
 * `error` is the catch-all transport/unknown failure.
 */
export type MintFailureReason =
  | 'sign-in-required'
  | 'not-a-beta-member'
  | 'quota-exceeded'
  | 'error'

export type MintResult =
  | {
      readonly ok: true
      readonly token: string
      /** UNIX seconds — when the short-lived token expires. */
      readonly expiresAt: number
      readonly used: number
      readonly quota: number
    }
  | { readonly ok: false; readonly reason: MintFailureReason }

/** Outcome of redeeming a beta invite code. */
export type RedeemResult = 'redeemed' | 'invalid' | 'error'

/** The header chip's snapshot: beta membership + this month's usage. */
export interface AccountStatus {
  readonly member: boolean
  readonly used: number
  readonly quota: number
}

export interface AuthPort {
  /** The current session (reads the persisted one on first call). */
  currentState(): Promise<AuthState>
  /** Subscribe to sign-in/sign-out; returns an unsubscribe. */
  onChange(listener: (state: AuthState) => void): () => void
  /** Send a magic-link email (passwordless sign-in). */
  sendMagicLink(email: string): Promise<void>
  signOut(): Promise<void>
  /** Redeem a beta invite code for the signed-in user (idempotent server-side). */
  redeemBetaCode(code: string): Promise<RedeemResult>
  /** Membership + this month's usage for the header chip. Quota-free (read-only).
   * Undefined when signed out or on error. */
  accountStatus(): Promise<AccountStatus | undefined>
  /**
   * Mint a short-lived analyse token via the Edge Function. Beta-gated and
   * quota-metered server-side; the typed failure tells the UI how to respond.
   */
  mintToken(): Promise<MintResult>
}
