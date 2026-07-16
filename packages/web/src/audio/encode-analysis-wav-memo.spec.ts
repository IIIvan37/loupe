import { type DecodedAudio, downmixToMono, encodeWav } from '@app/core'
import { describe, expect, it, vi } from 'vitest'
import {
  ANALYSIS_SAMPLE_RATE,
  encodeAnalysisWavMemo
} from './encode-analysis-wav-memo.ts'

function makeAudio(sampleRate = 48000): DecodedAudio {
  return {
    sampleRate,
    channels: [new Float32Array([1, 0, -1]), new Float32Array([0, 0.5, -0.5])]
  }
}

describe('encodeAnalysisWavMemo', () => {
  it('resamples the mono fold to the analysis rate before encoding', async () => {
    const audio = makeAudio(48000)
    const resampled = new Float32Array([0.5, 0.25])
    const resample = vi.fn().mockResolvedValue(resampled)

    const wav = await encodeAnalysisWavMemo(audio, resample)

    expect(resample).toHaveBeenCalledWith(
      downmixToMono(audio.channels),
      48000,
      ANALYSIS_SAMPLE_RATE
    )
    expect(wav).toEqual(encodeWav([resampled], ANALYSIS_SAMPLE_RATE))
  })

  it('folds to mono at the source rate when no resampler is available', async () => {
    // jsdom (and any runtime without OfflineAudioContext) still gets the mono
    // half of the saving — the server resamples whatever rate it receives.
    const audio = makeAudio(48000)

    const wav = await encodeAnalysisWavMemo(audio, undefined)

    expect(wav).toEqual(encodeWav([downmixToMono(audio.channels)], 48000))
  })

  it('keeps the source rate when it is already at or below the analysis rate', async () => {
    // Upsampling would inflate the payload for nothing.
    const audio = makeAudio(16000)
    const resample = vi.fn()

    const wav = await encodeAnalysisWavMemo(audio, resample)

    expect(resample).not.toHaveBeenCalled()
    expect(wav).toEqual(encodeWav([downmixToMono(audio.channels)], 16000))
  })

  it('encodes once per audio object and reuses the bytes', async () => {
    const audio = makeAudio(48000)
    const resample = vi.fn().mockResolvedValue(new Float32Array([0.5]))

    const first = await encodeAnalysisWavMemo(audio, resample)
    const second = await encodeAnalysisWavMemo(audio, resample)

    expect(second).toBe(first)
    expect(resample).toHaveBeenCalledTimes(1)
  })

  it('does not cache a failed encode — the next call retries', async () => {
    const audio = makeAudio(48000)
    const failing = vi.fn().mockRejectedValue(new Error('render failed'))
    await expect(encodeAnalysisWavMemo(audio, failing)).rejects.toThrow(
      'render failed'
    )

    const resampled = new Float32Array([0.5])
    const working = vi.fn().mockResolvedValue(resampled)

    await expect(encodeAnalysisWavMemo(audio, working)).resolves.toEqual(
      encodeWav([resampled], ANALYSIS_SAMPLE_RATE)
    )
  })
})
