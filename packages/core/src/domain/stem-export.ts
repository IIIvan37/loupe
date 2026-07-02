/**
 * Naming and alignment of the exported stem folder — pure. Each stem becomes a
 * numbered WAV (`01_Voix.wav`…) and every channel is brought to one shared frame
 * count, so all files start at t=0 and last exactly as long: what a DAW needs to
 * drop the folder on a timeline with no nudging.
 */

/** `01_Voix.wav` — numbered in display order, for a tidy stem folder. */
export function stemExportFilename(index: number, label: string): string {
  return `${String(index + 1).padStart(2, '0')}_${label}.wav`
}

/**
 * Bring every channel to exactly `frames` samples: zero-pad a short one,
 * truncate a long one, hand back an already-right one untouched (the common
 * case — stems from one separation share their length — costs no copy).
 */
export function padChannels(
  channels: ReadonlyArray<ArrayLike<number>>,
  frames: number
): ReadonlyArray<ArrayLike<number>> {
  return channels.map((channel) => {
    if (channel.length === frames) {
      return channel
    }
    const adjusted = new Float64Array(frames)
    const copied = Math.min(channel.length, frames)
    for (let i = 0; i < copied; i++) {
      adjusted[i] = channel[i] ?? 0
    }
    return adjusted
  })
}
