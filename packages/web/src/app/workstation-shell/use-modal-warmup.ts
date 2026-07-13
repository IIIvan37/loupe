import type { DecodedAudio } from '@app/core'
import { useEffect } from 'react'
import { warmUpAnalysis } from '../../audio/warm-up-analysis.ts'

/**
 * Warm the GPU inference container when a track loads (the spike's mitigation:
 * cold ~50 s, warm 0.5 s) so the user's later « Détecter… » is hot. Fire once
 * per fresh PCM; a replaced track (or unmount) aborts the in-flight warmup.
 * Against the local server the warmup is a no-op (no token), so this is inert
 * off the offload — safe to wire unconditionally.
 *
 * `warmUp` is injectable for tests; it defaults to the real (env-bound) prefetch.
 */
export function useModalWarmup(
  loadedAudio: DecodedAudio | undefined,
  warmUp: (signal: AbortSignal) => void = warmUpAnalysis
): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies(warmUp): the warmup fn is stable (module-level default / injected once in tests); the effect keys on the TRACK — a fresh PCM fires one prefetch, a replaced track or unmount aborts it.
  useEffect(() => {
    if (!loadedAudio) {
      return
    }
    const controller = new AbortController()
    warmUp(controller.signal)
    return () => controller.abort()
  }, [loadedAudio])
}
