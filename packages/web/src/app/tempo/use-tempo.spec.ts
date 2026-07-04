// @vitest-environment jsdom
import type { DecodedAudio, TempoDetector } from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useTempo } from './use-tempo.ts'

const audio: DecodedAudio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }

function detectorOf(bpm: number, beatsSeconds: number[]): TempoDetector {
  return { detect: async () => ({ bpm, beatsSeconds }) }
}

describe('useTempo', () => {
  it('starts idle with no analysis', () => {
    const { result } = renderHook(() => useTempo(detectorOf(120, [])))
    expect(result.current.analysis).toBeUndefined()
    expect(result.current.detecting).toBe(false)
  })

  it('exposes the detected BPM and grid after a run', async () => {
    const { result } = renderHook(() => useTempo(detectorOf(120, [0, 0.5, 1])))
    await act(async () => {
      await result.current.detect(audio)
    })
    expect(result.current.analysis?.bpm).toBe(120)
    expect(result.current.analysis?.grid).toHaveLength(3)
  })

  it('surfaces the detector failure as an error', async () => {
    const boom: TempoDetector = {
      detect: async () => {
        throw new Error('server down')
      }
    }
    const { result } = renderHook(() => useTempo(boom))
    await act(async () => {
      await result.current.detect(audio)
    })
    expect(result.current.error).toBe('server down')
  })

  it('clears the analysis on reset', async () => {
    const { result } = renderHook(() => useTempo(detectorOf(120, [0, 1])))
    await act(async () => {
      await result.current.detect(audio)
    })
    act(() => result.current.reset())
    expect(result.current.analysis).toBeUndefined()
  })

  it('discards a stale run superseded by a reset', async () => {
    let release: (() => void) | undefined
    const gated: TempoDetector = {
      detect: () =>
        new Promise((resolve) => {
          release = () => resolve({ bpm: 90, beatsSeconds: [0] })
        })
    }
    const { result } = renderHook(() => useTempo(gated))
    let pending: Promise<unknown> | undefined
    act(() => {
      pending = result.current.detect(audio)
    })
    act(() => result.current.reset())
    await act(async () => {
      release?.()
      await pending
    })
    // The reset superseded the in-flight detect — its late result is dropped.
    expect(result.current.analysis).toBeUndefined()
  })
})
