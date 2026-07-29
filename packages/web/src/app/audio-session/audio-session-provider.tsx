import type { ReactNode } from 'react'
import { type AudioSession, AudioSessionContext } from './audio-session.ts'

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
