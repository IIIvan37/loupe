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
 * The session the regions see: the injected ports plus the live player as a
 * stable reference (ADR 0011). The shell mounts it once the player exists;
 * both parts keep one identity, so the enriched value never changes after
 * mount and re-renders no one.
 */
export function AudioSessionWithPlayer({
  player,
  children
}: {
  readonly player: PlayerHandle
  readonly children: ReactNode
}) {
  const injected = useAudioSession()
  const value = useMemo(() => ({ ...injected, player }), [injected, player])
  return (
    <AudioSessionContext.Provider value={value}>
      {children}
    </AudioSessionContext.Provider>
  )
}
