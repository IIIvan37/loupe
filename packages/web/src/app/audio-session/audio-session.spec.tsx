// @vitest-environment jsdom
import type {
  AudioFileDecoder,
  PlaybackEngine,
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
  type PlaybackTransport,
  type PlayerHandle,
  useAudioSession,
  usePlayerHandle,
  useStemAudio,
  useStemMixGraph,
  useStemTransport
} from './audio-session.ts'

/**
 * An inert player: every verb a no-op, the playhead frozen at 0 — the two
 * describes below assert WHO gets the handle, never what it does. Declared
 * once here so a verb added to {@link PlayerHandle} costs one edit.
 */
function fakePlayerHandle(position: ExternalValue<number>): PlayerHandle {
  return {
    position,
    readSpectrum: () => undefined,
    seekToSeconds: () => {},
    seekToRatio: () => {},
    importFile: async () => undefined,
    togglePlayback: () => {},
    setTimeRatio: () => {},
    setPitchSemitones: () => {},
    setFineTuneCents: () => {},
    restoreTuning: () => {},
    restoreLoop: () => {},
    toggleLoop: () => {},
    setLoopRegion: () => {},
    speedTrainer: { start: () => {}, stop: () => {}, cross: () => {} }
  }
}

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
  const player = fakePlayerHandle(position)

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

describe('useStemMixGraph', () => {
  const gains: [string, number][] = []
  /** A stem engine of which the mixer must see only the gain-graph slice. */
  const engine = {
    load: async () => {},
    addStem: async () => {},
    removeStem: () => {},
    play: () => {},
    pause: () => {},
    seekTo: () => {},
    setTimeRatio: () => {},
    setPitchSemitones: () => {},
    setGain: (id: string, gain: number) => {
      gains.push([id, gain])
    },
    stemAudio: () => undefined,
    onPositionChange: () => () => {}
  } satisfies StemPlaybackEngine

  it('drives the seated gain graph through the narrow interface', () => {
    const wrapper = ({ children }: { readonly children: ReactNode }) => (
      <AudioSessionProvider value={{ stemEngine: engine }}>
        {children}
      </AudioSessionProvider>
    )

    const { result } = renderHook(() => useStemMixGraph(), { wrapper })
    result.current?.setGain('bass', 0.5)

    expect(gains).toEqual([['bass', 0.5]])
  })

  it('is undefined while no engine is seated — the mixer requires one itself', () => {
    const { result } = renderHook(() => useStemMixGraph())

    expect(result.current).toBeUndefined()
  })
})

describe('useStemTransport', () => {
  const driven: string[] = []
  /** A stem engine of which the transport must see only the shared slice. */
  const engine = {
    load: async () => {},
    addStem: async () => {},
    removeStem: () => {},
    play: () => driven.push('play'),
    pause: () => driven.push('pause'),
    seekTo: (seconds: number) => driven.push(`seekTo ${seconds}`),
    setTimeRatio: () => {},
    setPitchSemitones: () => {},
    setGain: () => {},
    stemAudio: () => undefined,
    onPositionChange: () => () => {}
  } satisfies StemPlaybackEngine

  it('drives the seated transport through the narrow interface', () => {
    const wrapper = ({ children }: { readonly children: ReactNode }) => (
      <AudioSessionProvider value={{ stemEngine: engine }}>
        {children}
      </AudioSessionProvider>
    )

    const { result } = renderHook(() => useStemTransport(), { wrapper })
    result.current?.play()
    result.current?.seekTo(12)

    expect(driven).toEqual(['play', 'seekTo 12'])
  })

  it('is undefined while no engine is seated — nothing to drive yet', () => {
    const { result } = renderHook(() => useStemTransport())

    expect(result.current).toBeUndefined()
  })

  it('covers the single-track engine too — one transport, two engines', () => {
    // The reason the hand-off can swap them: the slice is not stem-specific,
    // it is the surface `PlaybackEngine` and `StemPlaybackEngine` share. The
    // track engine carries `load`/`unload` ON TOP of it — the track lifecycle
    // the hand-off drives, which is why it stays a whole `PlaybackEngine`.
    const played: string[] = []
    const track: PlaybackEngine = {
      load: async () => {},
      play: () => played.push('track'),
      pause: () => {},
      seekTo: () => {},
      setTimeRatio: () => {},
      setPitchSemitones: () => {},
      unload: () => {},
      onPositionChange: () => () => {}
    }
    const stem: StemPlaybackEngine = { ...engine, play: () => played.push('mix') }

    for (const transport of [track, stem] satisfies PlaybackTransport[]) {
      transport.play()
    }

    expect(played).toEqual(['track', 'mix'])
  })
})

describe('AudioSessionWithPlayer', () => {
  const position: ExternalValue<number> = {
    get: () => 0,
    subscribe: () => () => {}
  }
  const player = fakePlayerHandle(position)
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
