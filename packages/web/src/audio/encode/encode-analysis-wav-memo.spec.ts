import { type DecodedAudio, downmixToMono, encodeWav } from '@app/core'
import { describe, expect, it, vi } from 'vitest'
import {
  encodeAnalysisWav,
  encodeAnalysisWavMemo
} from './encode-analysis-wav-memo.ts'

function makeAudio(sampleRate = 48000): DecodedAudio {
  return {
    sampleRate,
    channels: [new Float32Array([1, 0, -1]), new Float32Array([0, 0.5, -0.5])]
  }
}

describe('encodeAnalysisWav', () => {
  it('resamples the mono fold to 24 kHz before encoding', async () => {
    const audio = makeAudio(48000)
    const resampled = new Float32Array([0.5, 0.25])
    const resample = vi.fn().mockResolvedValue(resampled)

    const wav = await encodeAnalysisWav(audio, resample)

    expect(resample).toHaveBeenCalledWith(
      downmixToMono(audio.channels),
      48000,
      24000
    )
    expect(wav).toEqual(encodeWav([resampled], 24000))
  })

  it('folds to mono at the source rate when the runtime has no resampler', async () => {
    // jsdom (and any runtime without OfflineAudioContext) still gets the mono
    // half of the saving — the server resamples whatever rate it receives.
    const audio = makeAudio(48000)

    const wav = await encodeAnalysisWav(audio, null)

    expect(wav).toEqual(encodeWav([downmixToMono(audio.channels)], 48000))
  })

  it('keeps the source rate when it is already at or below 24 kHz', async () => {
    // Upsampling would inflate the payload for nothing.
    const audio = makeAudio(16000)
    const resample = vi.fn()

    const wav = await encodeAnalysisWav(audio, resample)

    expect(resample).not.toHaveBeenCalled()
    expect(wav).toEqual(encodeWav([downmixToMono(audio.channels)], 16000))
  })

  it('does not resample zero-length audio', async () => {
    // An OfflineAudioContext cannot render zero frames — skip it.
    const audio: DecodedAudio = {
      sampleRate: 48000,
      channels: [new Float32Array(0)]
    }
    const resample = vi.fn()

    const wav = await encodeAnalysisWav(audio, resample)

    expect(resample).not.toHaveBeenCalled()
    expect(wav).toEqual(encodeWav([new Float32Array(0)], 48000))
  })

  it('falls back to the source-rate mono fold when resampling fails', async () => {
    // Resampling only shrinks the upload; a render failure (out-of-range
    // source rate, exotic device) must not fail the detection itself.
    const audio = makeAudio(48000)
    const resample = vi.fn().mockRejectedValue(new Error('render failed'))

    const wav = await encodeAnalysisWav(audio, resample)

    expect(wav).toEqual(encodeWav([downmixToMono(audio.channels)], 48000))
  })
})

describe('encodeAnalysisWavMemo', () => {
  it('encodes like encodeAnalysisWav with the runtime resampler', async () => {
    // In this environment there is no OfflineAudioContext, so the runtime
    // path is the source-rate mono fold.
    const audio = makeAudio(48000)
    expect(await encodeAnalysisWavMemo(audio)).toEqual(
      await encodeAnalysisWav(audio, null)
    )
  })

  it('encodes once per audio object and reuses the bytes', async () => {
    const audio = makeAudio(48000)
    expect(await encodeAnalysisWavMemo(audio)).toBe(
      await encodeAnalysisWavMemo(audio)
    )
  })

  it('does not cache a failed encode — the next call retries', async () => {
    // A DecodedAudio with no channels makes the mono fold throw.
    const broken = { sampleRate: 48000, channels: [] as Float32Array[] }
    await expect(encodeAnalysisWavMemo(broken)).rejects.toThrow(
      'at least one channel'
    )

    const fixed = { ...broken, channels: [new Float32Array([0.5])] }
    await expect(encodeAnalysisWavMemo(fixed)).resolves.toEqual(
      encodeWav([new Float32Array([0.5])], 48000)
    )
  })
})
