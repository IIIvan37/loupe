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

describe('installDeepLinkAuth', () => {
  it('exchanges the code from the first valid callback in a batch', async () => {
    const { client, exchangeCodeForSession } = fakeClient()
    let deliver: (urls: string[]) => void = () => {}
    installDeepLinkAuth(client, async (handler) => {
      deliver = handler
      return () => {}
    })
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
    installDeepLinkAuth(client, async (handler) => {
      deliver = handler
      return () => {}
    })
    deliver(['loupe://auth-callback'])
    deliver([])
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })
})
