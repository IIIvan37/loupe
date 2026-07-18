// @vitest-environment jsdom
import type { DecodedAudio } from '@app/core'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { useMetronome } from '../tempo/use-metronome.ts'
import type { useTempo } from '../tempo/use-tempo.ts'
import { useTempoDetection } from './use-tempo-detection.ts'

const AUDIO: DecodedAudio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }

function fakeTempo() {
  return {
    detect: vi.fn(async () => undefined),
    deferDetection: vi.fn()
  } as unknown as ReturnType<typeof useTempo> & {
    detect: ReturnType<typeof vi.fn>
    deferDetection: ReturnType<typeof vi.fn>
  }
}

const metronome = {
  enabled: false,
  enable: vi.fn(),
  reseat: vi.fn()
} as unknown as ReturnType<typeof useMetronome>

describe('useTempoDetection — the import must not spend the quota (AG.1)', () => {
  it('auto-detects when a detection needs no fresh mint', () => {
    const tempo = fakeTempo()
    renderHook(() =>
      useTempoDetection({
        tempo,
        metronome,
        loadedAudio: AUDIO,
        separationOwnsMix: false,
        autoDetectSpendsNothing: () => true
      })
    )
    expect(tempo.detect).toHaveBeenCalledTimes(1)
  })

  it('defers the auto-detection when it would mint — the item stays on offer', () => {
    const tempo = fakeTempo()
    renderHook(() =>
      useTempoDetection({
        tempo,
        metronome,
        loadedAudio: AUDIO,
        separationOwnsMix: false,
        autoDetectSpendsNothing: () => false
      })
    )
    expect(tempo.detect).not.toHaveBeenCalled()
    expect(tempo.deferDetection).toHaveBeenCalledTimes(1)
  })

  it('« Réessayer » is an explicit gesture — it always runs (and may mint)', () => {
    const tempo = fakeTempo()
    const { result } = renderHook(() =>
      useTempoDetection({
        tempo,
        metronome,
        loadedAudio: AUDIO,
        separationOwnsMix: false,
        autoDetectSpendsNothing: () => false
      })
    )
    result.current.retry()
    expect(tempo.detect).toHaveBeenCalledTimes(1)
  })
})
