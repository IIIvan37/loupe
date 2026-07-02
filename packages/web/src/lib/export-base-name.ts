/**
 * The stem zip's base name: a usable (non-blank) tag title, else the imported
 * file's name without its extension, else 'stems'. An empty ID3 title is
 * truthy for `??` (it is not nullish) — hence the explicit blank checks.
 */
export function exportBaseName(
  title: string | undefined,
  trackName: string | null | undefined
): string {
  const cleanTitle = title?.trim()
  if (cleanTitle) {
    return cleanTitle
  }
  const cleanTrack = trackName?.replace(/\.[^.]+$/, '').trim()
  return cleanTrack || 'stems'
}
