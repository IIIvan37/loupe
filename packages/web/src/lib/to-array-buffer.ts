/**
 * Reframe a `Uint8Array` (from the fs plugin, a decoder, …) as the plain
 * `ArrayBuffer` a port promises. When the view already spans its whole
 * backing buffer the buffer is returned as-is; otherwise a compact copy is
 * made so the caller never sees bytes outside the view. The result is meant
 * to be read, not mutated in place.
 */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const whole =
    bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
  return whole
    ? (bytes.buffer as ArrayBuffer)
    : (bytes.slice().buffer as ArrayBuffer)
}
