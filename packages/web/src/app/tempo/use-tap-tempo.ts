import { appendTap, tapTempoBpm } from '@app/core'
import { useRef } from 'react'

/** Wall-clock seconds — tap intervals are real time, not track time. */
function wallClockSeconds(): number {
  return performance.now() / 1000
}

/**
 * Collect tap instants and read a tempo out of them (median inter-tap
 * interval, via the pure domain): each tap past the first reports the current
 * reading through `onBpm`. The sequence self-resets after a 2 s silence. The
 * clock is injectable for tests; real usage taps against `performance.now()`.
 */
export function useTapTempo(
  onBpm: (bpm: number) => void,
  now: () => number = wallClockSeconds
): () => void {
  // A ref, not state: taps drive no render — only the `onBpm` side channel.
  const tapsRef = useRef<readonly number[]>([])
  return () => {
    tapsRef.current = appendTap(tapsRef.current, now())
    const bpm = tapTempoBpm(tapsRef.current)
    if (bpm !== undefined) {
      onBpm(bpm)
    }
  }
}
