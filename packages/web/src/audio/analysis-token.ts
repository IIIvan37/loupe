import { appAuth } from '../auth/app-auth.ts'
import type { AuthPort, MintFailureReason } from '../auth/auth-port.ts'

/**
 * The analyse-token gate. Analysis on the Modal offload needs a SHORT-LIVED
 * token minted per call by the Supabase Edge Function (beta-gated,
 * quota-metered). This module owns acquiring and caching it, and is the seam
 * both the UI gate (`ensureAnalysisToken`, before an analysis) and the detector
 * adapter (`cachedAnalysisToken`, when it uploads) read.
 *
 * Auth is a WEB concern: none of this touches the pure core. When no offload is
 * configured (`VITE_STRUCTURE_URL` unset) every call is a no-op pass — the
 * detector talks to the token-less local server.
 */

const SKEW_SECONDS = 30

let cached: { token: string; expiresAt: number } | undefined

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

/** Whether analysis is offloaded to Modal (and therefore gated). */
export function isAnalysisOffloaded(): boolean {
  return Boolean(import.meta.env.VITE_STRUCTURE_URL)
}

/**
 * The current minted token, or undefined when none is cached (local server, or
 * not yet minted this session). The detector sends it as `Authorization`; undefined
 * means no header — the token-less local path. Quota-free: it never mints.
 */
export function cachedAnalysisToken(): string | undefined {
  if (cached && cached.expiresAt - nowSeconds() > SKEW_SECONDS) {
    return cached.token
  }
  return undefined
}

/** Drop the cached token (on sign-out — the next analysis re-mints). */
export function clearAnalysisToken(): void {
  cached = undefined
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
  const result = await auth.mintToken()
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
