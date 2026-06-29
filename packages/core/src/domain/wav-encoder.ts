/**
 * Encode PCM channels as a 16-bit little-endian WAV (RIFF) byte stream — pure,
 * values in / bytes out, so an adapter can write a stem to a file or a Blob. All
 * channels share the first channel's length; samples are clamped to [-1, 1] and
 * interleaved frame by frame.
 */

const HEADER_BYTES = 44
const BYTES_PER_SAMPLE = 2

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i))
  }
}

/** Clamp to [-1, 1] then scale to a signed 16-bit integer (full-scale both ways). */
function toInt16(sample: number): number {
  const clamped = sample < -1 ? -1 : sample > 1 ? 1 : sample
  return Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff)
}

export function encodeWav(
  channels: ReadonlyArray<ArrayLike<number>>,
  sampleRate: number
): Uint8Array<ArrayBuffer> {
  if (channels.length < 1) {
    throw new Error('at least one channel is required')
  }
  if (!Number.isInteger(sampleRate) || sampleRate < 1) {
    throw new Error('sample rate must be a positive integer')
  }

  const numChannels = channels.length
  const frames = channels[0]?.length ?? 0
  if (channels.some((channel) => channel.length !== frames)) {
    throw new Error('all channels must have the same length')
  }
  const blockAlign = numChannels * BYTES_PER_SAMPLE
  const dataSize = frames * blockAlign
  const buffer = new ArrayBuffer(HEADER_BYTES + dataSize)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // PCM fmt chunk size
  view.setUint16(20, 1, true) // audio format: PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true) // byte rate
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 8 * BYTES_PER_SAMPLE, true) // bits per sample
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = HEADER_BYTES
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < numChannels; channel++) {
      view.setInt16(offset, toInt16(channels[channel]?.[frame] ?? 0), true)
      offset += BYTES_PER_SAMPLE
    }
  }
  return new Uint8Array(buffer)
}
