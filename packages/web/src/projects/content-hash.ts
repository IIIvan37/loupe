/**
 * The shared content-addressing contract: an audio blob's ref is the lowercase
 * sha256 hex of its bytes. Server, HTTP adapter and filesystem adapter all
 * spell refs this way — a manifest saved through one resolves through another.
 */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}
