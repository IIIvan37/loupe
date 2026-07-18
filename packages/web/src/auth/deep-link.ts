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

export function installDeepLinkAuth(
  client: SupabaseClient,
  subscribe: OpenUrlSubscribe
): void {
  void subscribe((urls) => {
    for (const url of urls) {
      const callback = parseAuthCallback(url)
      if (callback) {
        void client.auth.exchangeCodeForSession(callback.code)
        return
      }
    }
  })
}
