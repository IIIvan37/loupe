/**
 * The first audio file in a drop, or undefined when none qualifies.
 *
 * Mirrors the picker's `accept="audio/*"`: a file counts as audio when its MIME
 * type is `audio/*`. Browsers sometimes hand a dropped file an empty type (e.g.
 * `.flac`/`.aiff` on some platforms), so we fall back to a known-extension
 * allowlist — the same containers the app already decodes.
 */

const AUDIO_EXTENSIONS = [
  '.wav',
  '.mp3',
  '.m4a',
  '.aac',
  '.flac',
  '.ogg',
  '.oga',
  '.opus',
  '.aif',
  '.aiff',
  '.wma'
]

function looksLikeAudio(file: File): boolean {
  if (file.type.startsWith('audio/')) {
    return true
  }
  const name = file.name.toLowerCase()
  return AUDIO_EXTENSIONS.some((ext) => name.endsWith(ext))
}

export function pickAudioFile(files: readonly File[]): File | undefined {
  return files.find(looksLikeAudio)
}
