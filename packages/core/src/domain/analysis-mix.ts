import { downmixToMono } from './downmix.ts'

/** Structural twin of the application's DecodedAudio — the domain never
 * imports upward; the shapes stay assignable both ways. */
interface MonoMix {
  readonly sampleRate: number
  readonly channels: ReadonlyArray<ArrayLike<number>>
}

/**
 * The analysis mix rebuilt from separated stems, minus one instrument — the
 * drums-less signal the chord detector prefers (a full mix stays BTC's
 * training regime, but the percussive noise adds nothing harmonic). Each
 * stem is downmixed to mono then summed, padded to the longest; undefined
 * when nothing remains to sum (no stems, or only the excluded one).
 */
export function monoMixWithout(
  stems: ReadonlyArray<{ readonly id: string; readonly audio: MonoMix }>,
  excludedId: string
): MonoMix | undefined {
  const kept = stems.filter((stem) => stem.id !== excludedId)
  const first = kept[0]
  if (first === undefined) {
    return undefined
  }
  const monos = kept.map((stem) => downmixToMono(stem.audio.channels))
  const mix = new Float32Array(Math.max(...monos.map((mono) => mono.length)))
  for (const mono of monos) {
    for (let i = 0; i < mono.length; i++) {
      mix[i] = (mix[i] ?? 0) + (mono[i] ?? 0)
    }
  }
  return { sampleRate: first.audio.sampleRate, channels: [mix] }
}
