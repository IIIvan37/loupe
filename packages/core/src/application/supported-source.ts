/**
 * Which media hosts loupe can download from — the yt-dlp direct-URL scope
 * (YouTube / SoundCloud). This is application policy about our adapters, not an
 * audio-domain invariant, so it lives with the use-cases rather than in the
 * domain. Spotify/Deezer are deliberately excluded: their streams are DRM'd and
 * only resolvable via a metadata → YouTube-search detour we chose not to take.
 *
 * Two adapters re-check this list at their own trust boundary — the server
 * (`server/app/download.py` `_SUPPORTED_HOSTS`) and the desktop shell's Rust
 * download command (`packages/desktop/src-tauri/src/download.rs`
 * `SUPPORTED_HOSTS`). Add a host in all three, or the desktop/server build
 * will reject a URL the browser accepts.
 */
const SUPPORTED_HOSTS: readonly string[] = [
  'youtube.com',
  'youtu.be',
  'soundcloud.com'
]

/**
 * True when `url` is a well-formed http(s) URL whose host is a supported media
 * source (matched on the registrable host or one of its subdomains, so
 * `music.youtube.com` counts but `youtube.com.evil.example` does not).
 */
export function isSupportedSourceUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
  const host = parsed.hostname.toLowerCase()
  return SUPPORTED_HOSTS.some(
    (supported) => host === supported || host.endsWith(`.${supported}`)
  )
}
