import { describe, expect, it } from 'vitest'
import { loadTrack } from './load-track.ts'
import type { AudioFileDecoder, DecodedAudio, PlaybackEngine } from './ports.ts'

const bytes = new ArrayBuffer(8)

/** In-memory fake of the driven decoder port: PCM in, no real Web Audio. */
function fakeDecoder(decoded: DecodedAudio): AudioFileDecoder {
  return { decode: async () => decoded }
}

/** Capturing fake of the playback engine port; records what it was loaded with. */
function capturingEngine(): PlaybackEngine & {
  loaded: DecodedAudio | undefined
} {
  return {
    loaded: undefined,
    async load(audio) {
      this.loaded = audio
    },
    play() {},
    pause() {},
    seekTo() {},
    setTimeRatio() {},
    setPitchSemitones() {},
    unload() {},
    onPositionChange() {
      return () => {}
    }
  }
}

describe('loadTrack — when the decoder yields PCM', () => {
  const decoded: DecodedAudio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }
  const decoder = fakeDecoder(decoded)

  it('returns an ok Result carrying a Track', async () => {
    const result = await loadTrack(
      { bytes, bucketCount: 2 },
      { decoder, engine: capturingEngine() }
    )
    expect(result.ok).toBe(true)
  })

  it('derives duration from the sample count and rate', async () => {
    const result = await loadTrack(
      { bytes, bucketCount: 2 },
      { decoder, engine: capturingEngine() }
    )
    if (!result.ok) throw new Error('expected ok')
    // 4 samples / 4 Hz = 1 second.
    expect(result.track.durationSeconds).toBe(1)
    expect(result.track.sampleRate).toBe(4)
  })

  it('reduces the samples to the requested number of waveform buckets', async () => {
    const result = await loadTrack(
      { bytes, bucketCount: 2 },
      { decoder, engine: capturingEngine() }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(result.track.waveform.peaks).toHaveLength(2)
    // First half [0, 1] → max 1; second half [-1, 0.5] → min -1.
    expect(result.track.waveform.peaks[0]).toEqual({ min: 0, max: 1 })
    expect(result.track.waveform.peaks[1]).toEqual({ min: -1, max: 0.5 })
  })

  it('hands the decoded PCM to the playback engine (decoded once)', async () => {
    const engine = capturingEngine()
    await loadTrack({ bytes, bucketCount: 2 }, { decoder, engine })
    expect(engine.loaded).toBe(decoded)
  })

  it('returns the decoded PCM so separation can reuse the same audio', async () => {
    const result = await loadTrack(
      { bytes, bucketCount: 2 },
      { decoder, engine: capturingEngine() }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(result.audio).toBe(decoded)
  })
})

describe('loadTrack — when decoding or the input is invalid', () => {
  const engine = capturingEngine()

  it('turns a decoder failure into a typed error Result', async () => {
    const decoder: AudioFileDecoder = {
      decode: async () => {
        throw new Error('unsupported format')
      }
    }
    const result = await loadTrack(
      { bytes, bucketCount: 2 },
      { decoder, engine }
    )
    expect(result).toEqual({ ok: false, error: 'unsupported format' })
  })

  it('stringifies a rejected non-Error value', async () => {
    const decoder: AudioFileDecoder = {
      decode: () => Promise.reject('boom')
    }
    const result = await loadTrack(
      { bytes, bucketCount: 2 },
      { decoder, engine }
    )
    expect(result).toEqual({ ok: false, error: 'boom' })
  })

  it('reports an engine load failure as a typed error', async () => {
    const failingEngine: PlaybackEngine = {
      ...capturingEngine(),
      load: async () => {
        throw new Error('engine unavailable')
      }
    }
    const result = await loadTrack(
      { bytes, bucketCount: 2 },
      {
        decoder: fakeDecoder({ sampleRate: 4, channels: [[0, 1]] }),
        engine: failingEngine
      }
    )
    expect(result).toEqual({ ok: false, error: 'engine unavailable' })
  })
})
