import type { StemPlaybackEngine, StemSeparator } from '@app/core'
import { useMemo } from 'react'
import { createWebAudioStemPlayback } from '../../audio/web-audio-stem-playback.ts'
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
  stemEngine: StemPlaybackEngine | undefined,
  separator: StemSeparator | undefined
) {
  const stemPlayback = useMemo(
    () => stemEngine ?? createWebAudioStemPlayback(),
    [stemEngine]
  )
  const separation = useSeparation(stemPlayback.stemAudio, separator)
  const mixer = useMixer(stemPlayback)
  return {
    stemPlayback,
    separation,
    mixer,
    stemsReady: separation.state.status === 'ready'
  }
}
