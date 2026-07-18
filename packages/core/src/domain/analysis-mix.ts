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
 * stem's channels are averaged and accumulated straight into the output
 * (no per-stem mono materialised — five ~42 MB intermediates on a 4-minute
 * track otherwise spike transient memory ~×5), padded to the longest;
 * undefined when nothing remains to sum (no stems, or only the excluded
 * one).
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
  const length = Math.max(
    ...kept.map((stem) => stem.audio.channels[0]?.length ?? 0)
  )
  const mix = new Float32Array(length)
  for (const stem of kept) {
    const channels = stem.audio.channels
    const count = channels.length
    if (count === 0) {
      continue
    }
    const stemLength = channels[0]?.length ?? 0
    for (let i = 0; i < stemLength; i++) {
      let sum = 0
      for (const channel of channels) {
        sum += Number(channel[i] ?? 0)
      }
      mix[i] = (mix[i] as number) + sum / count
    }
  }
  return { sampleRate: first.audio.sampleRate, channels: [mix] }
}
