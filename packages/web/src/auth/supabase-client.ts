import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * The Supabase client, or `null` when the project isn't configured (local dev
 * against the token-less server, or tests). Memoised so auth state and its
 * localStorage-backed session are shared app-wide. The anon key is public by
 * design — RLS, not secrecy, guards the data.
 */
let client: SupabaseClient | null | undefined

export function getSupabaseClient(): SupabaseClient | null {
  if (client === undefined) {
    const url = import.meta.env.VITE_SUPABASE_URL
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    // PKCE (AC.3): the magic-link callback carries a one-time `code` that is
    // useless without the locally-stored verifier — a hijacked `loupe://`
    // scheme or a foreign callback installs nothing. Trade-off: the link must
    // be opened by the same client profile that requested it (the normal
    // magic-link gesture).
    client =
      url && anonKey
        ? createClient(url, anonKey, { auth: { flowType: 'pkce' } })
        : null
  }
  return client
}
