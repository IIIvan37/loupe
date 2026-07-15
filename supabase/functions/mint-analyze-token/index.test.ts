// Integration test for mint-analyze-token, run against the LIVE local stack
// (supabase start). It exercises the real links: Supabase getUser, the
// consume_analysis RPC, and HS256 minting — only the CLI's container wrapper is
// bypassed (blocked by Colima bind-mounts locally).
//
//   deno test --allow-net --allow-env supabase/functions/mint-analyze-token/index.test.ts
//
// Prereqs (the harness script sets these): a beta member `member@loupe.test`
// and an outsider `outsider@loupe.test` exist, password `password123`.

import { assert, assertEquals } from 'jsr:@std/assert@1'
import { verify } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

const API = 'http://127.0.0.1:54321'
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SECRET = 'local-dev-analyze-secret-at-least-32-chars-long'

Deno.env.set('ANALYZE_JWT_SECRET', SECRET)
Deno.env.set('SUPABASE_URL', API)
Deno.env.set('SUPABASE_ANON_KEY', ANON)
// Keep the CORS assertions hermetic: the module reads this at import time,
// and an operator shell may export it (it drives the local server too).
Deno.env.delete('LOUPE_ALLOWED_ORIGINS')

const { handler, parseAllowedOrigins } = await import('./index.ts')

async function signIn(email: string): Promise<string> {
  const res = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' }),
  })
  const body = await res.json()
  assert(
    body.access_token,
    `sign-in failed for ${email}: ${JSON.stringify(body)}`,
  )
  return body.access_token
}

function mint(
  token: string | null,
  origin = 'http://localhost:5173',
): Promise<Response> {
  const headers: Record<string, string> = { origin }
  if (token) headers.Authorization = `Bearer ${token}`
  return handler(
    new Request(`${API}/functions/v1/mint-analyze-token`, {
      method: 'POST',
      headers,
    }),
  )
}

async function verifyKey(): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
}

Deno.test('member in quota -> 200 with a valid, correctly-claimed token', async () => {
  const token = await signIn('member@loupe.test')
  const res = await mint(token)
  assertEquals(res.status, 200)
  const body = await res.json()
  assertEquals(body.used, 1)
  assertEquals(body.quota, 20)
  assertEquals(
    res.headers.get('Access-Control-Allow-Origin'),
    'http://localhost:5173',
  )

  // The minted token must verify with the shared secret and carry our claims.
  const payload = await verify(body.token, await verifyKey())
  assertEquals(payload.aud, 'loupe-analyze')
  assertEquals(payload.iss, 'loupe-supabase')
  assert(typeof payload.sub === 'string' && payload.sub.length > 0)
  assert(typeof payload.exp === 'number' && payload.exp > payload.iat!)
})

Deno.test('a tampered minted token fails verification', async () => {
  const token = await signIn('member@loupe.test')
  const body = await (await mint(token)).json()
  const forged = body.token.slice(0, -4) +
    (body.token.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA')
  let threw = false
  try {
    await verify(forged, await verifyKey())
  } catch {
    threw = true
  }
  assert(threw, 'a token with a mangled signature must not verify')
})

Deno.test('a too-short shared secret -> 500 before any minting (no stack needed)', async () => {
  // U.3 floor: refuse to mint with a weak secret. The env check runs before
  // the Supabase fetches, so this test needs no live stack.
  Deno.env.set('ANALYZE_JWT_SECRET', 'too-short')
  try {
    const res = await mint('irrelevant-user-jwt')
    assertEquals(res.status, 500)
    assertEquals((await res.json()).error, 'server_misconfigured')
  } finally {
    Deno.env.set('ANALYZE_JWT_SECRET', SECRET)
  }
})

Deno.test('missing bearer token -> 401', async () => {
  const res = await mint(null)
  assertEquals(res.status, 401)
  assertEquals((await res.json()).error, 'missing_token')
})

Deno.test('outsider (not a beta member) -> 403', async () => {
  const token = await signIn('outsider@loupe.test')
  const res = await mint(token)
  assertEquals(res.status, 403)
  assertEquals((await res.json()).error, 'not_a_beta_member')
})

Deno.test('OPTIONS preflight -> 204 with CORS', async () => {
  const res = await handler(
    new Request(`${API}/functions/v1/mint-analyze-token`, {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:5173' },
    }),
  )
  assertEquals(res.status, 204)
  assertEquals(
    res.headers.get('Access-Control-Allow-Origin'),
    'http://localhost:5173',
  )
  await res.body?.cancel()
})

Deno.test('a disallowed origin gets no allow-origin echoed back', async () => {
  const token = await signIn('member@loupe.test')
  const res = await mint(token, 'http://evil.example')
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), '')
  await res.body?.cancel()
})

Deno.test('parseAllowedOrigins trims entries and drops empties (no stack needed)', () => {
  // Mirrors server/app/origins.py: a trailing comma or padded entries must
  // not admit '' as an origin.
  const origins = parseAllowedOrigins(
    ' https://loupe.example , http://localhost:5173,,',
  )
  assertEquals(
    origins,
    new Set(['https://loupe.example', 'http://localhost:5173']),
  )
  // Set-but-empty means "no origins" (never the defaults), and a literal '*'
  // is dropped — both mirror server/app/origins.py.
  assertEquals(parseAllowedOrigins(''), new Set())
  assertEquals(parseAllowedOrigins('*'), new Set())
})

Deno.test('quota exhaustion -> 429 once the monthly cap is spent', async () => {
  const token = await signIn('member@loupe.test')
  // The harness reset this member's usage to 0. First mint of this test spent 1,
  // plus the two 200-returning tests above. Rather than assume a count, spend
  // until the cap trips and assert the transition is a clean 429.
  let last = 200
  for (let i = 0; i < 25 && last === 200; i++) {
    last = (await mint(token)).status
  }
  assertEquals(last, 429)
  const res = await mint(token)
  assertEquals(res.status, 429)
  const body = await res.json()
  assertEquals(body.error, 'quota_exceeded')
  assertEquals(body.used, 20)
  assertEquals(body.quota, 20)
})
