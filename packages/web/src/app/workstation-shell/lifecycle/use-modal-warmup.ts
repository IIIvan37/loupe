import { useAtomValue } from 'jotai'
import { useEffect } from 'react'
import { warmUpAnalysis } from '../../../audio/http/warm-up-analysis.ts'
import { loadedAudioAtom } from '../../track/track-atoms.ts'

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
  warmUp: (signal: AbortSignal) => void = warmUpAnalysis
): void {
  // The loaded PCM is the player feature's atom (ADR 0010): read it here
  // rather than have the shell thread it down.
  const loadedAudio = useAtomValue(loadedAudioAtom)
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
