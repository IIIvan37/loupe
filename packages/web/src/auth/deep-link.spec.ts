import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { installDeepLinkAuth, parseAuthCallback } from './deep-link.ts'

describe('parseAuthCallback', () => {
  it('extracts the PKCE code from the auth-callback URL', () => {
    expect(parseAuthCallback('loupe://auth-callback?code=abc-123')).toEqual({
      code: 'abc-123'
    })
  })

  it('rejects a URL that is not the auth callback, even with a code', () => {
    expect(
      parseAuthCallback('loupe://other-route?code=abc-123')
    ).toBeUndefined()
    expect(
      parseAuthCallback('https://evil.example/auth-callback?code=abc-123')
    ).toBeUndefined()
  })

  it('rejects legacy implicit fragments — tokens never install from a URL', () => {
    expect(
      parseAuthCallback(
        'loupe://auth-callback#access_token=at-1&refresh_token=rt-1'
      )
    ).toBeUndefined()
  })

  it('rejects an error callback and a bare URL', () => {
    expect(
      parseAuthCallback('loupe://auth-callback?error=access_denied')
    ).toBeUndefined()
    expect(parseAuthCallback('loupe://auth-callback')).toBeUndefined()
  })
})

/** Only the call the deep-link wiring makes. */
function fakeClient() {
  const exchangeCodeForSession = vi.fn(async () => ({ error: null }))
  return {
    client: {
      auth: { exchangeCodeForSession }
    } as unknown as SupabaseClient,
    exchangeCodeForSession
  }
}

/** No launch URL — the app was opened normally. */
const noLaunchUrl = async () => null

describe('installDeepLinkAuth', () => {
  it('exchanges the code from the first valid callback in a batch', async () => {
    const { client, exchangeCodeForSession } = fakeClient()
    let deliver: (urls: string[]) => void = () => {}
    installDeepLinkAuth(
      client,
      async (handler) => {
        deliver = handler
        return () => {}
      },
      noLaunchUrl
    )
    deliver([
      'loupe://auth-callback?error=access_denied',
      'loupe://auth-callback?code=abc-123'
    ])
    await vi.waitFor(() =>
      expect(exchangeCodeForSession).toHaveBeenCalledTimes(1)
    )
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc-123')
  })

  it('ignores batches with no usable callback', async () => {
    const { client, exchangeCodeForSession } = fakeClient()
    let deliver: (urls: string[]) => void = () => {}
    installDeepLinkAuth(
      client,
      async (handler) => {
        deliver = handler
        return () => {}
      },
      noLaunchUrl
    )
    deliver(['loupe://auth-callback'])
    deliver([])
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('exchanges the code from the URL that LAUNCHED the app', async () => {
    // Cold start: the magic link starts the app — onOpenUrl never replays the
    // launch URL, so the install must read it explicitly (getCurrent).
    const { client, exchangeCodeForSession } = fakeClient()
    installDeepLinkAuth(
      client,
      async () => () => {},
      async () => ['loupe://auth-callback?code=cold-1']
    )
    await vi.waitFor(() =>
      expect(exchangeCodeForSession).toHaveBeenCalledWith('cold-1')
    )
  })

  it('a launch without deep link installs nothing', async () => {
    const { client, exchangeCodeForSession } = fakeClient()
    installDeepLinkAuth(client, async () => () => {}, noLaunchUrl)
    await Promise.resolve()
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('reports a failed exchange — a swallowed error left the user staring at « pas de session »', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const exchangeCodeForSession = vi.fn(async () => ({
        error: { message: 'code verifier not found' }
      }))
      const client = {
        auth: { exchangeCodeForSession }
      } as unknown as SupabaseClient
      installDeepLinkAuth(
        client,
        async () => () => {},
        async () => ['loupe://auth-callback?code=bad-1']
      )
      await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled())
    } finally {
      errorSpy.mockRestore()
    }
  })
})
