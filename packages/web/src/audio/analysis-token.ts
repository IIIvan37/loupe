import { appAuth } from '../auth/app-auth.ts'
import type { AuthPort, MintFailureReason } from '../auth/auth-port.ts'

/**
 * The analyse-token gate. Analysis on the Modal offload needs a SHORT-LIVED
 * token minted per call by the Supabase Edge Function (beta-gated,
 * quota-metered). This module owns acquiring and caching it, and is the seam
 * both the UI gate (`ensureAnalysisToken`, before an analysis) and the detector
 * adapter (`cachedAnalysisToken`, when it uploads) read.
 *
 * Auth is a WEB concern: none of this touches the pure core. When no endpoint
 * is configured (`VITE_ANALYSIS_URL` unset — dev/tests only) every call is a
 * no-op pass; a shipped build always has the endpoint set.
 */

const SKEW_SECONDS = 30

let cached: { token: string; expiresAt: number } | undefined
// Single-flight: concurrent gates share ONE mint (a mint spends a quota unit
// server-side — two simultaneous analyses must not spend two).
let inflight: Promise<EnsureTokenResult> | undefined
// Bumped by every clear (sign-out): a mint that started before the bump is
// superseded — its token belongs to the closed session and must not land.
let generation = 0

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

/** Whether analysis is offloaded to Modal (and therefore gated). */
export function isAnalysisOffloaded(): boolean {
  return Boolean(import.meta.env.VITE_ANALYSIS_URL)
}

/**
 * The current minted token, or undefined when none is cached (not yet minted
 * this session). The detector sends it as `Authorization`. Quota-free: it never
 * mints.
 */
export function cachedAnalysisToken(): string | undefined {
  if (cached && cached.expiresAt - nowSeconds() > SKEW_SECONDS) {
    return cached.token
  }
  return undefined
}

/** Drop the cached token (on sign-out — the next analysis re-mints). Also
 * supersedes any in-flight mint: its late token must not repopulate the cache,
 * and a new sign-in's analysis must not join it. */
export function clearAnalysisToken(): void {
  cached = undefined
  inflight = undefined
  generation += 1
}

/** This month's usage as the last mint reported it. */
export interface AnalysisUsage {
  readonly used: number
  readonly quota: number
}

// A fresh mint spends a quota unit server-side; the header chip subscribes here
// so it updates live instead of only on the next page load.
const usageListeners = new Set<(usage: AnalysisUsage) => void>()

export function onAnalysisUsage(
  listener: (usage: AnalysisUsage) => void
): () => void {
  usageListeners.add(listener)
  return () => usageListeners.delete(listener)
}

export type EnsureTokenResult =
  | { readonly ok: true; readonly used?: number; readonly quota?: number }
  | { readonly ok: false; readonly reason: MintFailureReason }

/**
 * Ensure a usable token exists before an analysis, minting one (which spends a
 * quota unit server-side) unless a fresh one is cached. Returns a typed failure
 * the UI maps to sign-in / redeem / quota prompts. A no-op success when not
 * offloaded. `auth` defaults to the app singleton; a spec injects a fake.
 */
export async function ensureAnalysisToken(
  auth: AuthPort | null = appAuth()
): Promise<EnsureTokenResult> {
  if (!isAnalysisOffloaded() || auth === null) {
    return { ok: true }
  }
  if (cachedAnalysisToken() !== undefined) {
    return { ok: true }
  }
  // Single-flight: a gate arriving while a mint is in flight joins it instead
  // of spending a second quota unit.
  inflight ??= mint(auth).finally(() => {
    inflight = undefined
  })
  return inflight
}

async function mint(auth: AuthPort): Promise<EnsureTokenResult> {
  const startedIn = generation
  const result = await auth.mintToken()
  // A sign-out since the mint started (the clear bumped the generation): the
  // token belongs to the closed session — refuse the run, cache nothing.
  if (generation !== startedIn) {
    return { ok: false, reason: 'sign-in-required' }
  }
  if (!result.ok) {
    return { ok: false, reason: result.reason }
  }
  cached = { token: result.token, expiresAt: result.expiresAt }
  if (result.used !== undefined && result.quota !== undefined) {
    const usage = { used: result.used, quota: result.quota }
    for (const listener of usageListeners) {
      listener(usage)
    }
  }
  return { ok: true, used: result.used, quota: result.quota }
}
