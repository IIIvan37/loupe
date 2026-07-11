import { type DecodedAudio, encodeWav } from '@app/core'
import { describe, expect, it } from 'vitest'
import { encodeWavMemo } from './encode-wav-memo.ts'

function makeAudio(samples: readonly number[]): DecodedAudio {
  return { sampleRate: 8000, channels: [Float32Array.from(samples)] }
}

describe('encodeWavMemo', () => {
  it('produces the same bytes as encodeWav', () => {
    const audio = makeAudio([0, 0.5, -0.5])
    expect(encodeWavMemo(audio)).toEqual(
      encodeWav(audio.channels, audio.sampleRate)
    )
  })

  it('returns the identical byte array on a second call with the same audio', () => {
    const audio = makeAudio([0, 0.25])
    expect(encodeWavMemo(audio)).toBe(encodeWavMemo(audio))
  })

  it('encodes a different audio object on its own, not from the cache', () => {
    const first = makeAudio([0, 0.5])
    encodeWavMemo(first)
    const second = makeAudio([0.5, 0])
    expect(encodeWavMemo(second)).toEqual(
      encodeWav(second.channels, second.sampleRate)
    )
  })
})
