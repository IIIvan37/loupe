import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthPort, MintResult } from '../auth/auth-port.ts'
import {
  cachedAnalysisToken,
  clearAnalysisToken,
  ensureAnalysisToken,
  isAnalysisOffloaded,
  onAnalysisUsage
} from './analysis-token.ts'

/** An AuthPort whose mint returns a scripted result and counts its calls. */
function fakeAuth(result: MintResult): AuthPort & { mints: number } {
  const auth = {
    mints: 0,
    currentState: async () => ({ status: 'signed-out' as const }),
    onChange: () => () => {},
    sendMagicLink: async () => {},
    signOut: async () => {},
    redeemBetaCode: async () => 'redeemed' as const,
    accountStatus: async () => undefined,
    async mintToken(): Promise<MintResult> {
      this.mints += 1
      return result
    }
  }
  return auth
}

const OK: MintResult = {
  ok: true,
  token: 'minted-tok',
  expiresAt: 10_000,
  used: 3,
  quota: 20
}

describe('analysis token gate', () => {
  beforeEach(() => {
    clearAnalysisToken()
    vi.setSystemTime(new Date(1000 * 1000)) // now = 1000s, well before exp 10000
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('is a no-op pass when analysis is not offloaded — never mints', async () => {
    vi.stubEnv('VITE_STRUCTURE_URL', '')
    const auth = fakeAuth(OK)
    expect(isAnalysisOffloaded()).toBe(false)
    expect(await ensureAnalysisToken(auth)).toEqual({ ok: true })
    expect(auth.mints).toBe(0)
    expect(cachedAnalysisToken()).toBeUndefined()
  })

  it('mints and caches a token when offloaded, surfacing the quota', async () => {
    vi.stubEnv('VITE_STRUCTURE_URL', 'https://modal.example')
    const auth = fakeAuth(OK)

    expect(await ensureAnalysisToken(auth)).toEqual({
      ok: true,
      used: 3,
      quota: 20
    })
    expect(cachedAnalysisToken()).toBe('minted-tok')
  })

  it('reuses a fresh cached token instead of minting again', async () => {
    vi.stubEnv('VITE_STRUCTURE_URL', 'https://modal.example')
    const auth = fakeAuth(OK)

    await ensureAnalysisToken(auth)
    await ensureAnalysisToken(auth)
    expect(auth.mints).toBe(1)
  })

  it('forwards a typed mint failure without caching', async () => {
    vi.stubEnv('VITE_STRUCTURE_URL', 'https://modal.example')
    const auth = fakeAuth({ ok: false, reason: 'not-a-beta-member' })

    expect(await ensureAnalysisToken(auth)).toEqual({
      ok: false,
      reason: 'not-a-beta-member'
    })
    expect(cachedAnalysisToken()).toBeUndefined()
  })

  it('treats a token within the expiry skew as absent (re-mints)', async () => {
    vi.stubEnv('VITE_STRUCTURE_URL', 'https://modal.example')
    const auth = fakeAuth(OK)
    await ensureAnalysisToken(auth)

    // 20 s before exp — inside the 30 s skew, so the cache is considered stale.
    vi.setSystemTime(new Date((OK.expiresAt - 20) * 1000))
    expect(cachedAnalysisToken()).toBeUndefined()
    await ensureAnalysisToken(auth)
    expect(auth.mints).toBe(2)
  })

  it('notifies usage listeners on a fresh mint (drives the live header chip)', async () => {
    vi.stubEnv('VITE_STRUCTURE_URL', 'https://modal.example')
    const seen: Array<{ used: number; quota: number }> = []
    const unsubscribe = onAnalysisUsage((u) => seen.push(u))

    await ensureAnalysisToken(fakeAuth(OK))
    expect(seen).toEqual([{ used: 3, quota: 20 }])

    // A cached token reuses without minting, so no further notification.
    await ensureAnalysisToken(fakeAuth(OK))
    expect(seen).toHaveLength(1)
    unsubscribe()
  })

  it('does not notify usage when not offloaded (no mint happened)', async () => {
    vi.stubEnv('VITE_STRUCTURE_URL', '')
    const seen: Array<{ used: number; quota: number }> = []
    const unsubscribe = onAnalysisUsage((u) => seen.push(u))
    await ensureAnalysisToken(fakeAuth(OK))
    expect(seen).toHaveLength(0)
    unsubscribe()
  })

  it('clearAnalysisToken drops the cache (sign-out)', async () => {
    vi.stubEnv('VITE_STRUCTURE_URL', 'https://modal.example')
    await ensureAnalysisToken(fakeAuth(OK))
    expect(cachedAnalysisToken()).toBe('minted-tok')

    clearAnalysisToken()
    expect(cachedAnalysisToken()).toBeUndefined()
  })
})
