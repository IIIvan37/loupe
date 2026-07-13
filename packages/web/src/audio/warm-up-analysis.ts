import { ANALYSIS_URL } from './analysis-endpoint.ts'
import { cachedAnalysisToken } from './analysis-token.ts'

/**
 * Warm the GPU inference container ahead of use — the mitigation the spike
 * settled on (cold ~50 s, warm 0.5 s): fire a `/warmup` when a track loads so
 * the container is hot by the time the user asks for an analysis, hiding the
 * cold start behind their think-time.
 *
 * Best-effort and silent: it only warms with an ALREADY-cached token — it never
 * mints, because minting spends a quota unit (J2) and a prefetch must be free.
 * No token (local server, or not signed in / not yet analysed this session) →
 * skip; the first real analysis then pays the cold start. Any failure is
 * swallowed. Aborted when the track is replaced (the caller's signal).
 */
export async function warmUpAnalysis(signal?: AbortSignal): Promise<void> {
  const token = cachedAnalysisToken()
  if (token === undefined) {
    return
  }
  try {
    await fetch(`${ANALYSIS_URL}/warmup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: signal ?? null
    })
  } catch {
    // Prefetch is an optimisation; a miss only costs the cold start later.
  }
}
