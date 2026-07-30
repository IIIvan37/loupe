import type { StemPlaybackEngine, StemSeparator } from '@app/core'
import { useMemo } from 'react'
import { createWebAudioStemPlayback } from '../../audio/web-audio-stem-playback.ts'
import { useAudioSession } from '../audio-session/audio-session.ts'
import { useMixer } from '../mixer/use-mixer.ts'
import { useSeparation } from '../separation/use-separation.ts'

/**
 * The stem playback stack: one engine shared by the mixer (gains + loading) and
 * the transport, the separation flow (its buffers are the stems' only retained
 * PCM — zero-copy export/save), and the mixer. Plus one derived flag,
 * `stemsReady` (a separation produced stems — drives the export + what a save
 * persists). Whether the mixer holds any stem is NOT here: it is the mixer's own
 * `stemsActiveAtom` (ADR 0010), read by whoever needs it — the metronome can
 * join the mix without a separation, so it was never the same fact anyway.
 */
export function useStemStack(
  stemEngine?: StemPlaybackEngine,
  separator?: StemSeparator
) {
  const session = useAudioSession()
  const injectedEngine = stemEngine ?? session.stemEngine
  const stemPlayback = useMemo(
    () => injectedEngine ?? createWebAudioStemPlayback(),
    [injectedEngine]
  )
  // The hook falls back to the session's separator itself; only the PCM
  // read-back is the stack's to hand over (its engine owns the buffers).
  const separation = useSeparation(stemPlayback.stemAudio, separator)
  const mixer = useMixer(stemPlayback)
  return {
    stemPlayback,
    separation,
    mixer,
    stemsReady: separation.state.status === 'ready'
  }
}
