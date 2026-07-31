import type { AuthPort } from './auth-port.ts'
import { createAuth } from './create-auth.ts'
import { getSupabaseClient } from './supabase-client.ts'

/**
 * The app-wide `AuthPort`, or `null` when Supabase isn't configured (local dev
 * against the token-less server). Memoised so the account UI and the analysis
 * gate share one session.
 */
let instance: AuthPort | null | undefined

export function appAuth(): AuthPort | null {
  if (instance === undefined) {
    const client = getSupabaseClient()
    const url = import.meta.env.VITE_SUPABASE_URL
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    instance =
      client && url && anonKey
        ? createAuth(client, `${url}/functions/v1`, anonKey)
        : null
  }
  return instance
}
