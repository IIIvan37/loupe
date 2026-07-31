// @vitest-environment jsdom
import type {
  AudioFileDecoder,
  StemPlaybackEngine,
  TempoDetector
} from '@app/core'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import type { ExternalValue } from '../../lib/external-value.ts'
import {
  AudioSessionProvider,
  AudioSessionWithPlayer
} from './audio-session-provider.tsx'
import {
  type PlayerHandle,
  useAudioSession,
  usePlayerHandle,
  useStemAudio
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
    setLoopRegion: () => {},
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

describe('useStemAudio', () => {
  const audio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }
  /** A stem engine of which the separation must see exactly ONE member. */
  const engine = {
    load: async () => {},
    addStem: async () => {},
    removeStem: () => {},
    play: () => {},
    pause: () => {},
    seekTo: () => {},
    setTimeRatio: () => {},
    setPitchSemitones: () => {},
    setGain: () => {},
    stemAudio: (id: string) => (id === 'bass' ? audio : undefined),
    onPositionChange: () => () => {}
  } satisfies StemPlaybackEngine

  it('reads a loaded stem back through the narrow custody interface', () => {
    const wrapper = ({ children }: { readonly children: ReactNode }) => (
      <AudioSessionProvider value={{ stemEngine: engine }}>
        {children}
      </AudioSessionProvider>
    )

    const { result } = renderHook(() => useStemAudio(), { wrapper })

    expect(result.current?.stemAudio('bass')).toBe(audio)
    expect(result.current?.stemAudio('vocals')).toBeUndefined()
  })

  it('is undefined while no engine is seated — no stems, no PCM to read', () => {
    const { result } = renderHook(() => useStemAudio())

    expect(result.current).toBeUndefined()
  })
})

describe('AudioSessionWithPlayer', () => {
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
    setLoopRegion: () => {},
    speedTrainer: { start: () => {}, stop: () => {} }
  }
  const stemEngine: StemPlaybackEngine = {
    load: async () => {},
    addStem: async () => {},
    removeStem: () => {},
    play: () => {},
    pause: () => {},
    seekTo: () => {},
    setTimeRatio: () => {},
    setPitchSemitones: () => {},
    setGain: () => {},
    stemAudio: () => undefined,
    onPositionChange: () => () => {}
  }

  it('seats the live stem engine beside the player, over the injected ports', () => {
    // The shell's singleton engine joins the enriched session (ADR 0011) so a
    // region's `useMixer()` drives the SAME graph as the shell's own instance.
    const wrapper = ({ children }: { readonly children: ReactNode }) => (
      <AudioSessionProvider value={{ decoder }}>
        <AudioSessionWithPlayer player={player} stemEngine={stemEngine}>
          {children}
        </AudioSessionWithPlayer>
      </AudioSessionProvider>
    )

    const { result } = renderHook(() => useAudioSession(), { wrapper })

    expect(result.current.player).toBe(player)
    expect(result.current.stemEngine).toBe(stemEngine)
    expect(result.current.decoder).toBe(decoder)
  })
})
