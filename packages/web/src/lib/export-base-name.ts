/**
 * The stem zip's base name: a usable (non-blank) tag title, else the imported
 * file's name without its extension, else 'stems'. An empty ID3 title is
 * truthy for `??` (it is not nullish) — hence the explicit blank checks.
 *
 * Titles/filenames come from ID3 tags or yt-dlp metadata (attacker-influenced),
 * and this value flows into a `download` filename + zip entry names. Browsers
 * neutralise the `download` attribute, but as defence in depth we strip path
 * separators, filesystem-reserved characters, and control characters, and trim
 * leading dots/spaces — so nothing traversal- or hidden-file-shaped survives.
 */

// Path separators, Windows-reserved chars, and C0 control characters.
// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point
const UNSAFE = /[/\\:*?"<>|\u0000-\u001f]/g

function sanitize(name: string): string {
  // After the whitespace collapse only spaces and dots can edge the name;
  // a manual trim avoids the `[.\s]+$` regex Sonar flags as super-linear.
  return trimEdges(name.replace(UNSAFE, ' ').replace(/\s+/g, ' '))
}

function isTrimmable(char: string): boolean {
  return char === '.' || char === ' '
}

function trimEdges(name: string): string {
  let start = 0
  let end = name.length
  while (start < end && isTrimmable(name.charAt(start))) start += 1
  while (end > start && isTrimmable(name.charAt(end - 1))) end -= 1
  return name.slice(start, end)
}

export function exportBaseName(
  title: string | undefined,
  trackName: string | null | undefined
): string {
  const cleanTitle = title ? sanitize(title) : ''
  if (cleanTitle) {
    return cleanTitle
  }
  const cleanTrack = trackName
    ? sanitize(trackName.replace(/\.[^.]+$/, ''))
    : ''
  return cleanTrack || 'stems'
}
