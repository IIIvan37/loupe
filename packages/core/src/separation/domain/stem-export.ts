/**
 * Naming and alignment of the exported stem folder — pure. Each stem becomes a
 * numbered WAV (`01_Voix.wav`…) and every channel is zero-padded to one shared
 * frame count, so all files start at t=0 and last exactly as long: what a DAW
 * needs to drop the folder on a timeline with no nudging.
 */

// Characters zip entries and filesystems reject (a `/` would even turn the
// flat stem folder into nested directories); collapsed to '-'. Labels come
// from outside the core (the separation server, a stored manifest).
const UNSAFE_FILENAME_CHARS = /[/\\:*?"<>|]/g

/** `01_Voix.wav` — numbered in display order, label made filename-safe. */
export function stemExportFilename(index: number, label: string): string {
  const safe = label.replace(UNSAFE_FILENAME_CHARS, '-')
  return `${String(index + 1).padStart(2, '0')}_${safe}.wav`
}

/**
 * Zero-pad every channel to exactly `frames` samples; a channel already the
 * right length is handed back untouched (the common case — stems from one
 * separation share their length — costs no copy). `frames` must cover the
 * longest channel: samples are never dropped, so a too-small `frames` (the
 * caller's bug) throws instead of silently truncating audio.
 */
export function padChannels(
  channels: ReadonlyArray<ArrayLike<number>>,
  frames: number
): ReadonlyArray<ArrayLike<number>> {
  return channels.map((channel) => {
    if (channel.length === frames) {
      return channel
    }
    const padded = new Float64Array(frames)
    // `set` refuses a source longer than its target — the no-truncation guard.
    padded.set(channel)
    return padded
  })
}
