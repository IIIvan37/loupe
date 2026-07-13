# J2 — Supabase auth for the Modal analyse offload (2026-07-13)

Branch `feat/supabase-j2`. Replaces J1's static Modal token with per-user
Supabase auth: magic-link sign-in → an Edge Function mints a short-lived HS256
JWT (beta-gated, quota-metered) → Modal verifies it → the web app injects it per
analysis. Plan: [modal-offload-impl-plan.md](../modal-offload-impl-plan.md)
§Jalon 2. Deploy steps: [j2-supabase-runbook.md](../j2-supabase-runbook.md).

## Product decisions (locked with the user)

- **Beta gating** = `beta_codes` table (redeem at sign-up), not invite-only.
- **Quota** = ~20 analyses / calendar month / user.
- **Build order** = infra-first, curl-verified each link.
- **Auth UX** = lazy inline gate (app stays offline-usable; only analysis actions
  prompt), account control in the **header**, sign-in + redeem in **one popover**.

## What shipped

**2.1 — Supabase schema** (`supabase/migrations/…j2_auth_quota.sql`):
`beta_codes`, `beta_members`, `usage` (RLS: a user reads only their own rows;
only the Edge Function writes usage). SECURITY DEFINER functions
`redeem_beta_code` (idempotent, row-locked), `consume_analysis` (atomic
beta-gate + monthly increment), `account_status` (read-only snapshot, quota-free).
Verified: `supabase/tests/j2_auth_quota.sql` — 10 asserts (idempotent redeem,
code drain, 20-cap, over-quota distinguishable from non-member).

**2.2 — Edge Function** (`supabase/functions/mint-analyze-token/`): verify user
JWT (GoTrue) → `consume_analysis` RPC → mint a 5-min HS256 token (djwt).
Dependency-light (plain fetch, no supabase-js). 403 non-member / 429 quota / 401
missing. Verified: 7 Deno tests against the live stack (`index.test.ts`).

**2.3 — Modal verify** (`server/app/analyze_auth.py`, wired into `modal_app.py`):
pure stdlib HS256 verifier (sig + exp + aud + iss, rejects `alg:none`). The
static token is gone; the secret moved to `loupe-analyze-jwt`. Verified: 17
pytest @ 100%, plus a real djwt→Python interop check. Full server suite 197 pass.

**2.4 — Web** (`packages/web/src/auth/**`, `audio/analysis-token.ts`,
`app/account/**`): an `AuthPort` (injectable) over supabase-js; an async token
**gate** (`ensureAnalysisToken` mints+caches; warmup stays quota-free reading the
cache only); the structure-detection hook runs the gate before the core use-case
and exposes `gateReason` (auth kept OUT of the pure core's error codes); an
`AccountMenu` (header) doing magic-link sign-in, beta-code redeem, and quota,
opened by the gate with a mapped notice. i18n copy extracted (`account.*`).

## Gate

`pnpm gate` green — **1280 tests** (+31), typecheck / biome / Sheriff /
impeccable / react-doctor / knip / jscpd / tokens all pass. `WorkstationShell`
kept < 300 lines (folded the `handleSeparate` guard into `useSeparateAndLoad`).
`biome`/`knip` exclude `supabase/` (Deno has its own `deno.json` fmt/lint).

## Not done here (needs the user's cloud accounts)

- Provision the cloud Supabase project + `db push` + `functions deploy` + set the
  shared secret; redeploy `modal_app.py` with `loupe-analyze-jwt`; set
  `VITE_SUPABASE_*` + `VITE_STRUCTURE_URL` in `.env.local`.
- **Full end-to-end browser-verify** on :5173 is blocked until the above — the
  runbook lists the curl checks to run against the real infra.

## Local-verify gotchas (Colima)

Disable the `analytics`/vector container in `supabase/config.toml`; the Edge
Function is verified by running its handler under Deno (the CLI's `functions
serve` can't bind-mount under Colima). Never run `deno test` from the repo root
(it rewrites `package.json`) — `supabase/functions/deno.json` pins the config.
