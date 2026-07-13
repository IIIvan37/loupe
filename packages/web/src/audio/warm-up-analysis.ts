import { ANALYSIS_URL, analysisToken } from './analysis-endpoint.ts'

/**
 * Warm the GPU inference container ahead of use — the mitigation the spike
 * settled on (cold ~50 s, warm 0.5 s): fire a `/warmup` when a track loads so
 * the container is hot by the time the user asks for an analysis, hiding the
 * cold start behind their think-time.
 *
 * Best-effort and silent: no token means the local server (no `/warmup`, skip);
 * any failure just means the first real request pays the cold start — never
 * surfaced. Aborted when the track is replaced (the caller's signal).
 */
export async function warmUpAnalysis(signal?: AbortSignal): Promise<void> {
  const token = analysisToken()
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
