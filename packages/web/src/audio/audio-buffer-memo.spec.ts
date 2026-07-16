import type { DecodedAudio } from '@app/core'
import { describe, expect, it } from 'vitest'
import { recallAudioBuffer, rememberAudioBuffer } from './audio-buffer-memo.ts'
import { audioBufferFrom } from './web-audio-shared.ts'

/** Equal-shaped audios on purpose: the memo must key on identity, not value. */
const someAudio = (): DecodedAudio => ({ sampleRate: 8, channels: [[0, 1]] })

/** jsdom has no AudioBuffer — an opaque token stands in; the memo never reads it. */
const someBuffer = (): AudioBuffer => ({}) as AudioBuffer

describe('audio-buffer-memo', () => {
  it('recalls the buffer remembered for the same decoded audio', () => {
    const audio = someAudio()
    const buffer = someBuffer()

    rememberAudioBuffer(audio, buffer)

    expect(recallAudioBuffer(audio)).toBe(buffer)
  })

  it('misses for audio that was never remembered', () => {
    expect(recallAudioBuffer(someAudio())).toBeUndefined()
  })

  it('does not cross between two equal-shaped audios', () => {
    const remembered = someAudio()
    rememberAudioBuffer(remembered, someBuffer())

    expect(recallAudioBuffer(someAudio())).toBeUndefined()
  })

  it('audioBufferFrom serves the remembered buffer without touching the context', () => {
    const audio = someAudio()
    const buffer = someBuffer()
    rememberAudioBuffer(audio, buffer)

    // A context with no methods: any copy attempt would throw, proving the
    // memo hit short-circuits the whole build-and-copy path.
    expect(audioBufferFrom({} as BaseAudioContext, audio)).toBe(buffer)
  })
})
