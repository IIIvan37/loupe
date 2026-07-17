/**
 * Decode a 16-bit little-endian PCM WAV (RIFF) byte stream back into PCM
 * channels — pure, bytes in / values out, the inverse of `encodeWav`. Samples
 * are de-interleaved frame by frame and scaled back to [-1, 1]. The mirror an
 * adapter uses to read stems a server returned, without touching Web Audio.
 */

/**
 * Decoded PCM: one Float32 array per channel at `sampleRate`. Structurally
 * compatible with the application's `DecodedAudio`, but declared here so the
 * domain stays free of any application dependency.
 */
export interface DecodedWav {
  readonly sampleRate: number
  readonly channels: ReadonlyArray<Float32Array>
}

const HEADER_BYTES = 44
const BYTES_PER_SAMPLE = 2

function readAscii(view: DataView, offset: number): string {
  let text = ''
  for (let i = 0; i < 4; i++) {
    text += String.fromCodePoint(view.getUint8(offset + i))
  }
  return text
}

/** Scale a signed 16-bit integer back to [-1, 1] (full-scale both ways). */
function fromInt16(sample: number): number {
  return sample < 0 ? sample / 0x8000 : sample / 0x7fff
}

export function decodeWav(bytes: ArrayBuffer): DecodedWav {
  if (bytes.byteLength < HEADER_BYTES) {
    throw new Error('not a WAV stream: too short for a RIFF header')
  }
  const view = new DataView(bytes)
  if (readAscii(view, 0) !== 'RIFF' || readAscii(view, 8) !== 'WAVE') {
    throw new Error('not a WAV stream: missing RIFF/WAVE tags')
  }

  const numChannels = view.getUint16(22, true)
  const sampleRate = view.getUint32(24, true)
  const dataSize = view.getUint32(40, true)
  if (numChannels < 1) {
    throw new Error('not a WAV stream: no channels')
  }

  const blockAlign = numChannels * BYTES_PER_SAMPLE
  const frames = Math.floor(dataSize / blockAlign)
  const channels = Array.from(
    { length: numChannels },
    () => new Float32Array(frames)
  )

  let offset = HEADER_BYTES
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < numChannels; channel++) {
      // biome-ignore lint/style/noNonNullAssertion: channel index is in range
      channels[channel]![frame] = fromInt16(view.getInt16(offset, true))
      offset += BYTES_PER_SAMPLE
    }
  }

  return { sampleRate, channels }
}
