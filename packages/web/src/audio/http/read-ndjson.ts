/**
 * Yield decoded NDJSON values from a streaming response body — one parsed JSON
 * object per newline-delimited line, with the trailing partial line carried
 * across chunks. Shared by the HTTP adapters that consume the server's streamed
 * progress contracts (separation, download).
 */
async function* readNdjson<T>(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<T> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    // Stream reads are inherently sequential — each chunk must be awaited before
    // the next, so this cannot be parallelised.
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const lines = buffer.split('\n')
    // The last element is the trailing partial line; keep it for the next chunk.
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed) {
        yield JSON.parse(trimmed) as T
      }
    }
    if (done) {
      const tail = buffer.trim()
      if (tail) {
        yield JSON.parse(tail) as T
      }
      return
    }
  }
}

/**
 * Consume a server's streamed NDJSON progress contract: forward each `progress`
 * event to `onProgress`, throw on an `error` event, and return the terminal
 * `done` event. Shared by the HTTP adapters (separation, download) whose streams
 * differ only in the payloads carried on those three event tags.
 */
export async function streamNdjson<
  E extends
    | { readonly type: 'progress' }
    | { readonly type: 'error'; readonly message: string }
    | { readonly type: 'done' }
>(
  body: ReadableStream<Uint8Array>,
  onProgress: (event: Extract<E, { type: 'progress' }>) => void
): Promise<Extract<E, { type: 'done' }>> {
  let done: Extract<E, { type: 'done' }> | undefined
  for await (const event of readNdjson<E>(body)) {
    if (event.type === 'progress') {
      onProgress(event as Extract<E, { type: 'progress' }>)
    } else if (event.type === 'error') {
      throw new Error((event as Extract<E, { type: 'error' }>).message)
    } else {
      done = event as Extract<E, { type: 'done' }>
    }
  }
  if (!done) {
    throw new Error('stream ended without a result')
  }
  return done
}
