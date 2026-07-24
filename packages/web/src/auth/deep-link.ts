import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Desktop auth callback, PKCE flow (AC.3): the magic link redirects the
 * system browser to `loupe://auth-callback?code=…` and the OS hands that URL
 * to the Tauri shell. The code is useless without the `code_verifier` the
 * client stored when it REQUESTED the link, so a hostile app hijacking the
 * `loupe://` scheme steals nothing, and a foreign code cannot fixate a
 * session (the exchange fails without the matching verifier). Tokens are
 * never read from a URL — the legacy implicit fragment is rejected.
 */
export type AuthCallback = {
  code: string
}

const CALLBACK_PREFIX = 'loupe://auth-callback'

export function parseAuthCallback(url: string): AuthCallback | undefined {
  if (
    url !== CALLBACK_PREFIX &&
    !url.startsWith(`${CALLBACK_PREFIX}?`) &&
    !url.startsWith(`${CALLBACK_PREFIX}#`)
  ) {
    return undefined
  }
  const query = url.split('#')[0]?.split('?')[1]
  if (!query) {
    return undefined
  }
  const code = new URLSearchParams(query).get('code')
  return code ? { code } : undefined
}

/** The shape of the deep-link plugin's `onOpenUrl` (injected for specs). */
export type OpenUrlSubscribe = (
  handler: (urls: string[]) => void
) => Promise<() => void>

/** The plugin's `getCurrent`: the URL(s) that LAUNCHED the app, or null. */
export type CurrentUrls = () => Promise<string[] | null>

export function installDeepLinkAuth(
  client: SupabaseClient,
  subscribe: OpenUrlSubscribe,
  current: CurrentUrls
): void {
  const handle = async (urls: readonly string[]): Promise<void> => {
    const callback = urls
      .map(parseAuthCallback)
      .find((parsed) => parsed !== undefined)
    if (!callback) {
      return
    }
    const { error } = await client.auth.exchangeCodeForSession(callback.code)
    if (error) {
      // Diagnosis-only (the state listeners simply see no session): a
      // silent failure here left the user staring at « pas de session ».
      console.error('auth callback exchange failed:', error.message)
    }
  }
  // Cold start: when the magic link LAUNCHES the app, onOpenUrl never
  // replays the launch URL — it must be read explicitly.
  void current().then((urls) => (urls ? handle(urls) : undefined))
  void subscribe((urls) => void handle(urls))
}
