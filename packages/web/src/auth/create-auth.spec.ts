import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAuth } from './create-auth.ts'

/** Minimal supabase-js stand-in: only the calls the AuthPort makes. */
function fakeClient(
  overrides: {
    session?: { access_token: string; user: { email: string } } | null
    rpc?: { data: unknown; error: unknown }
    otpError?: { message: string }
  } = {}
): SupabaseClient {
  const session = overrides.session ?? null
  return {
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } }
      }),
      signInWithOtp: async () => ({ error: overrides.otpError ?? null }),
      signOut: async () => ({ error: null })
    },
    rpc: async () => overrides.rpc ?? { data: true, error: null }
  } as unknown as SupabaseClient
}

const FUNCTIONS_URL = 'https://proj.supabase.co/functions/v1'
const ANON = 'anon-key'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createAuth', () => {
  it('reports the signed-in email, else signed-out', async () => {
    const inAuth = createAuth(
      fakeClient({ session: { access_token: 't', user: { email: 'a@b.co' } } }),
      FUNCTIONS_URL,
      ANON
    )
    expect(await inAuth.currentState()).toEqual({
      status: 'signed-in',
      session: { email: 'a@b.co' }
    })

    const out = createAuth(fakeClient({ session: null }), FUNCTIONS_URL, ANON)
    expect(await out.currentState()).toEqual({ status: 'signed-out' })
  })

  it('surfaces a magic-link send error', async () => {
    const auth = createAuth(
      fakeClient({ otpError: { message: 'rate limited' } }),
      FUNCTIONS_URL,
      ANON
    )
    await expect(auth.sendMagicLink('a@b.co')).rejects.toThrow('rate limited')
  })

  it('maps beta-code redemption: true -> redeemed, false -> invalid, error -> error', async () => {
    const redeemed = createAuth(
      fakeClient({ rpc: { data: true, error: null } }),
      FUNCTIONS_URL,
      ANON
    )
    expect(await redeemed.redeemBetaCode('GOLDEN')).toBe('redeemed')

    const invalid = createAuth(
      fakeClient({ rpc: { data: false, error: null } }),
      FUNCTIONS_URL,
      ANON
    )
    expect(await invalid.redeemBetaCode('NOPE')).toBe('invalid')

    const errored = createAuth(
      fakeClient({ rpc: { data: null, error: { message: 'boom' } } }),
      FUNCTIONS_URL,
      ANON
    )
    expect(await errored.redeemBetaCode('x')).toBe('error')
  })

  it('reads the account status snapshot (membership + usage), undefined on error', async () => {
    const ok = createAuth(
      fakeClient({
        rpc: { data: [{ member: true, used: 3, quota: 20 }], error: null }
      }),
      FUNCTIONS_URL,
      ANON
    )
    expect(await ok.accountStatus()).toEqual({
      member: true,
      used: 3,
      quota: 20
    })

    const errored = createAuth(
      fakeClient({ rpc: { data: null, error: { message: 'boom' } } }),
      FUNCTIONS_URL,
      ANON
    )
    expect(await errored.accountStatus()).toBeUndefined()
  })

  it('returns sign-in-required when there is no session (never calls the endpoint)', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
    const auth = createAuth(fakeClient({ session: null }), FUNCTIONS_URL, ANON)

    expect(await auth.mintToken()).toEqual({
      ok: false,
      reason: 'sign-in-required'
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('mints a token for a signed-in member, forwarding the access token + apikey', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ token: 'jwt', expiresAt: 123, used: 1, quota: 20 }),
          { status: 200 }
        )
      )
    vi.stubGlobal('fetch', fetchMock)
    const auth = createAuth(
      fakeClient({
        session: { access_token: 'user-jwt', user: { email: 'a@b.co' } }
      }),
      FUNCTIONS_URL,
      ANON
    )

    expect(await auth.mintToken()).toEqual({
      ok: true,
      token: 'jwt',
      expiresAt: 123,
      used: 1,
      quota: 20
    })
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe(`${FUNCTIONS_URL}/mint-analyze-token`)
    const headers = new Headers(init?.headers)
    expect(headers.get('Authorization')).toBe('Bearer user-jwt')
    expect(headers.get('apikey')).toBe(ANON)
  })

  it.each([
    [403, 'not-a-beta-member'],
    [429, 'quota-exceeded'],
    [500, 'error']
  ])('maps mint HTTP %s -> %s', async (status, reason) => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status }))
    )
    const auth = createAuth(
      fakeClient({ session: { access_token: 't', user: { email: 'a@b.co' } } }),
      FUNCTIONS_URL,
      ANON
    )
    expect(await auth.mintToken()).toEqual({ ok: false, reason })
  })

  it('maps a network throw and a malformed body to error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'))
    )
    const netAuth = createAuth(
      fakeClient({ session: { access_token: 't', user: { email: 'a@b.co' } } }),
      FUNCTIONS_URL,
      ANON
    )
    expect(await netAuth.mintToken()).toEqual({ ok: false, reason: 'error' })

    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(JSON.stringify({ token: 'jwt' }), { status: 200 })
        )
    )
    const badAuth = createAuth(
      fakeClient({ session: { access_token: 't', user: { email: 'a@b.co' } } }),
      FUNCTIONS_URL,
      ANON
    )
    expect(await badAuth.mintToken()).toEqual({ ok: false, reason: 'error' })
  })
})
