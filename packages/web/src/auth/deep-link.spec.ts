import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { installDeepLinkAuth, parseAuthCallback } from './deep-link.ts'

describe('parseAuthCallback', () => {
  it('extracts the token pair from a callback fragment', () => {
    expect(
      parseAuthCallback(
        'loupe://auth-callback#access_token=at-1&refresh_token=rt-1&token_type=bearer&type=magiclink'
      )
    ).toEqual({ accessToken: 'at-1', refreshToken: 'rt-1' })
  })

  it('rejects a fragment missing either token', () => {
    expect(
      parseAuthCallback('loupe://auth-callback#access_token=at-1')
    ).toBeUndefined()
    expect(
      parseAuthCallback('loupe://auth-callback#refresh_token=rt-1')
    ).toBeUndefined()
  })

  it('rejects an error callback and a bare URL', () => {
    expect(
      parseAuthCallback(
        'loupe://auth-callback#error=access_denied&error_code=otp_expired'
      )
    ).toBeUndefined()
    expect(parseAuthCallback('loupe://auth-callback')).toBeUndefined()
  })
})

/** Only the call the deep-link wiring makes. */
function fakeClient() {
  const setSession = vi.fn(async () => ({ error: null }))
  return {
    client: { auth: { setSession } } as unknown as SupabaseClient,
    setSession
  }
}

describe('installDeepLinkAuth', () => {
  it('installs the session from the first valid callback in a batch', async () => {
    const { client, setSession } = fakeClient()
    let deliver: (urls: string[]) => void = () => {}
    installDeepLinkAuth(client, async (handler) => {
      deliver = handler
      return () => {}
    })
    deliver([
      'loupe://auth-callback#error=access_denied',
      'loupe://auth-callback#access_token=at-1&refresh_token=rt-1'
    ])
    await vi.waitFor(() => expect(setSession).toHaveBeenCalledTimes(1))
    expect(setSession).toHaveBeenCalledWith({
      access_token: 'at-1',
      refresh_token: 'rt-1'
    })
  })

  it('ignores batches with no usable callback', async () => {
    const { client, setSession } = fakeClient()
    let deliver: (urls: string[]) => void = () => {}
    installDeepLinkAuth(client, async (handler) => {
      deliver = handler
      return () => {}
    })
    deliver(['loupe://auth-callback'])
    deliver([])
    expect(setSession).not.toHaveBeenCalled()
  })
})
