// @vitest-environment jsdom
import type { AudioFileDecoder, TempoDetector } from '@app/core'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import type { ExternalValue } from '../../lib/external-value.ts'
import { AudioSessionProvider } from './audio-session-provider.tsx'
import {
  type PlayerHandle,
  useAudioSession,
  usePlayerHandle
} from './audio-session.ts'

const decoder: AudioFileDecoder = {
  decode: async () => ({ sampleRate: 4, channels: [[0, 1, -1, 0.5]] })
}
const tempoDetector: TempoDetector = { detect: () => new Promise(() => {}) }

describe('useAudioSession', () => {
  it('hands a consumer the injected ports — one injection point (ADR 0011)', () => {
    const wrapper = ({ children }: { readonly children: ReactNode }) => (
      <AudioSessionProvider value={{ decoder, tempoDetector }}>
        {children}
      </AudioSessionProvider>
    )

    const { result } = renderHook(() => useAudioSession(), { wrapper })

    expect(result.current.decoder).toBe(decoder)
    expect(result.current.tempoDetector).toBe(tempoDetector)
  })

  it('defaults to an empty session — consumers fall back to real adapters', () => {
    const { result } = renderHook(() => useAudioSession())

    expect(result.current).toEqual({})
  })
})

describe('usePlayerHandle', () => {
  const position: ExternalValue<number> = {
    get: () => 0,
    subscribe: () => () => {}
  }
  const player: PlayerHandle = {
    position,
    readSpectrum: () => undefined,
    seekToSeconds: () => {},
    seekToRatio: () => {},
    toggleLoop: () => {},
    speedTrainer: { start: () => {}, stop: () => {} }
  }

  it('hands a region the player the shell seated', () => {
    const wrapper = ({ children }: { readonly children: ReactNode }) => (
      <AudioSessionProvider value={{ player }}>{children}</AudioSessionProvider>
    )

    const { result } = renderHook(() => usePlayerHandle(), { wrapper })

    expect(result.current).toBe(player)
  })

  it('throws outside the shell — no player is a programming error, not a fallback', () => {
    expect(() => renderHook(() => usePlayerHandle())).toThrow(
      /no player in the audio session/
    )
  })
})
