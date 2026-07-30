import type { StemPlaybackEngine } from '@app/core'
import { type ReactNode, useMemo } from 'react'
import {
  type AudioSession,
  AudioSessionContext,
  type PlayerHandle,
  useAudioSession
} from './audio-session.ts'

/**
 * The ONE injection point for the audio ports (ADR 0011) — tests mount it
 * with fakes instead of threading a dozen positional props; production,
 * injecting nothing, needs no Provider at all (the empty default stands).
 */
export function AudioSessionProvider({
  value,
  children
}: {
  readonly value: AudioSession
  readonly children: ReactNode
}) {
  return (
    <AudioSessionContext.Provider value={value}>
      {children}
    </AudioSessionContext.Provider>
  )
}

/**
 * The session the regions see: the injected ports plus the live player and the
 * live stem engine as stable references (ADR 0011). The shell mounts it once
 * they exist; every part keeps one identity, so the enriched value never
 * changes after mount and re-renders no one. The stem engine is seated for the
 * same reason as the player: a region's `useMixer()` must drive the SHELL's
 * singleton gain graph, never a private one.
 */
export function AudioSessionWithPlayer({
  player,
  stemEngine,
  children
}: {
  readonly player: PlayerHandle
  readonly stemEngine: StemPlaybackEngine
  readonly children: ReactNode
}) {
  const injected = useAudioSession()
  const value = useMemo(
    () => ({ ...injected, player, stemEngine }),
    [injected, player, stemEngine]
  )
  return (
    <AudioSessionContext.Provider value={value}>
      {children}
    </AudioSessionContext.Provider>
  )
}
