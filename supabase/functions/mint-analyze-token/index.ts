// Edge Function: mint-analyze-token (J2.2)
//
// The broker between a signed-in loupe user and the Modal analyse endpoint.
// The app never holds the Modal secret; it asks this function for a SHORT-LIVED
// token, then calls Modal directly with it (the audio is too large to proxy
// through an Edge Function).
//
// Flow, per request (POST, no body):
//   1. Verify the caller's Supabase access token (Authorization: Bearer <jwt>).
//   2. consume_analysis() — atomic beta-gate + monthly quota increment (SQL).
//        not a beta member -> 403 ;  at/over quota -> 429.
//   3. Mint an HS256 JWT signed with ANALYZE_JWT_SECRET (shared with Modal):
//        { sub, aud: 'loupe-analyze', iss: 'loupe-supabase', exp: now+TTL }.
//   4. Return { token, expiresAt, used, quota }.
//
// Secrets (supabase secrets set / Edge Function env):
//   SUPABASE_URL, SUPABASE_ANON_KEY  — injected by the platform.
//   ANALYZE_JWT_SECRET               — HS256 secret, ALSO set as a Modal secret.

import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

const TOKEN_TTL_SECONDS = 300 // 5 min — long enough to cover a cold Modal start.
const AUDIENCE = 'loupe-analyze'
const ISSUER = 'loupe-supabase'

// Origins allowed to call this function from a browser. Mirror the Modal CORS
// list; dev app is on 5173.
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : ''
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    // `apikey` is required: the browser sends it, and it is NOT a
    // CORS-safelisted header, so the preflight fails without it here.
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  }
}

function json(
  body: unknown,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(origin) },
  })
}

async function signingKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get('origin')

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, origin)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'missing_token' }, 401, origin)
  }

  const analyzeSecret = Deno.env.get('ANALYZE_JWT_SECRET')
  if (!analyzeSecret) {
    // Misconfiguration, not the caller's fault.
    return json({ error: 'server_misconfigured' }, 500, origin)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) {
    return json({ error: 'server_misconfigured' }, 500, origin)
  }
  // Forward the caller's JWT on both calls: GoTrue verifies the token's
  // signature (401 if forged/expired), and PostgREST sets auth.uid() from it so
  // consume_analysis() sees the right user.
  const forward = { apikey: anonKey, Authorization: authHeader }

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: forward,
  })
  if (!userRes.ok) {
    return json({ error: 'invalid_token' }, 401, origin)
  }
  const user = await userRes.json()
  if (!user?.id) {
    return json({ error: 'invalid_token' }, 401, origin)
  }

  const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_analysis`, {
    method: 'POST',
    headers: { ...forward, 'content-type': 'application/json' },
    body: '{}',
  })
  if (!rpcRes.ok) {
    return json({ error: 'quota_check_failed' }, 500, origin)
  }
  // PostgREST returns a set-returning function as an array of rows.
  const data = await rpcRes.json()
  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    return json({ error: 'quota_check_failed' }, 500, origin)
  }
  if (!row.allowed) {
    // used === 0 with allowed=false means "not a beta member"; otherwise it is
    // a real quota exhaustion. consume_analysis() never increments in either
    // case, so the two are distinguishable by the count.
    if (row.used === 0) {
      return json({ error: 'not_a_beta_member' }, 403, origin)
    }
    return json(
      { error: 'quota_exceeded', used: row.used, quota: row.quota },
      429,
      origin,
    )
  }

  const key = await signingKey(analyzeSecret)
  const iat = getNumericDate(0)
  const exp = getNumericDate(TOKEN_TTL_SECONDS)
  const token = await create(
    { alg: 'HS256', typ: 'JWT' },
    { sub: user.id, aud: AUDIENCE, iss: ISSUER, iat, exp },
    key,
  )

  return json(
    { token, expiresAt: exp, used: row.used, quota: row.quota },
    200,
    origin,
  )
}

// Auto-serve only when run as the Edge Function entrypoint; importing this
// module in a test does not bind a port.
if (import.meta.main) {
  Deno.serve(handler)
}
