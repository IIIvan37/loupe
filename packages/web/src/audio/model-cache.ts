const CACHE_NAME = 'loupe-models'

/**
 * Fetch a (large) model file once and cache it, so the heavy download happens a
 * single time. On a cache miss the body is streamed so `onProgress` can report
 * the download fraction. Shared by every separator adapter — the model fetch is
 * the only thing that ever leaves the machine.
 */
export async function fetchCachedModel(
  url: string,
  onProgress: (fraction: number) => void
): Promise<ArrayBuffer> {
  const cache = await caches.open(CACHE_NAME)
  const hit = await cache.match(url)
  if (hit) {
    onProgress(1)
    return hit.arrayBuffer()
  }

  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`model download failed (${response.status})`)
  }
  const total = Number(response.headers.get('content-length')) || 0
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  for (;;) {
    // Reading a stream is inherently sequential — each chunk depends on the prior.
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    chunks.push(value)
    received += value.length
    if (total > 0) {
      onProgress(received / total)
    }
  }

  const bytes = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  await cache.put(
    url,
    new Response(bytes, {
      headers: { 'content-type': 'application/octet-stream' }
    })
  )
  onProgress(1)
  return bytes.buffer
}
