import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Desktop auth callback: the magic link redirects the system browser to
 * `loupe://auth-callback#access_token=…&refresh_token=…`, the OS hands that
 * URL to the Tauri shell, and the session is installed explicitly via
 * `setSession` — a fragment alone never reloads an already-open page.
 */
export type AuthCallbackTokens = {
  accessToken: string
  refreshToken: string
}

export function parseAuthCallback(url: string): AuthCallbackTokens | undefined {
  const fragment = url.split('#')[1]
  if (!fragment) {
    return undefined
  }
  const params = new URLSearchParams(fragment)
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  return accessToken && refreshToken ? { accessToken, refreshToken } : undefined
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
      const tokens = parseAuthCallback(url)
      if (tokens) {
        void client.auth.setSession({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken
        })
        return
      }
    }
  })
}
