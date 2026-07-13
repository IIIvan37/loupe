import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AccountStatus,
  AuthPort,
  AuthState,
  MintResult,
  RedeemResult
} from './auth-port.ts'

/** Where the magic link returns the user — the running app origin. */
function redirectTo(): string | undefined {
  try {
    return window.location.origin
  } catch {
    return undefined
  }
}

/**
 * The production `AuthPort`, backed by supabase-js + the mint Edge Function.
 * `client` and `functionsUrl` are injected so a spec can drive it with a fake
 * client and a stubbed `fetch` (no real network). `anonKey` rides on the mint
 * request as the platform's `apikey`.
 */
export function createAuth(
  client: SupabaseClient,
  functionsUrl: string,
  anonKey: string
): AuthPort {
  return {
    async currentState(): Promise<AuthState> {
      const { data } = await client.auth.getSession()
      const email = data.session?.user.email
      return email
        ? { status: 'signed-in', session: { email } }
        : { status: 'signed-out' }
    },

    onChange(listener: (state: AuthState) => void): () => void {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        const email = session?.user.email
        listener(
          email
            ? { status: 'signed-in', session: { email } }
            : { status: 'signed-out' }
        )
      })
      return () => data.subscription.unsubscribe()
    },

    async sendMagicLink(email: string): Promise<void> {
      const origin = redirectTo()
      const { error } = await client.auth.signInWithOtp({
        email,
        options: origin ? { emailRedirectTo: origin } : {}
      })
      if (error) {
        throw new Error(error.message)
      }
    },

    async signOut(): Promise<void> {
      await client.auth.signOut()
    },

    async redeemBetaCode(code: string): Promise<RedeemResult> {
      const { data, error } = await client.rpc('redeem_beta_code', {
        p_code: code
      })
      if (error) {
        return 'error'
      }
      return data === true ? 'redeemed' : 'invalid'
    },

    async accountStatus(): Promise<AccountStatus | undefined> {
      const { data, error } = await client.rpc('account_status')
      if (error) {
        return undefined
      }
      const row = Array.isArray(data) ? data[0] : data
      if (!row) {
        return undefined
      }
      return {
        member: row.member === true,
        used: Number(row.used),
        quota: Number(row.quota)
      }
    },

    async mintToken(): Promise<MintResult> {
      const { data } = await client.auth.getSession()
      const accessToken = data.session?.access_token
      if (!accessToken) {
        return { ok: false, reason: 'sign-in-required' }
      }
      let response: Response
      try {
        response = await fetch(`${functionsUrl}/mint-analyze-token`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, apikey: anonKey }
        })
      } catch {
        return { ok: false, reason: 'error' }
      }
      if (response.status === 403) {
        return { ok: false, reason: 'not-a-beta-member' }
      }
      if (response.status === 429) {
        return { ok: false, reason: 'quota-exceeded' }
      }
      if (!response.ok) {
        return { ok: false, reason: 'error' }
      }
      const body = (await response.json()) as {
        token?: unknown
        expiresAt?: unknown
        used?: unknown
        quota?: unknown
      }
      if (
        typeof body.token !== 'string' ||
        typeof body.expiresAt !== 'number' ||
        typeof body.used !== 'number' ||
        typeof body.quota !== 'number'
      ) {
        return { ok: false, reason: 'error' }
      }
      return {
        ok: true,
        token: body.token,
        expiresAt: body.expiresAt,
        used: body.used,
        quota: body.quota
      }
    }
  }
}
