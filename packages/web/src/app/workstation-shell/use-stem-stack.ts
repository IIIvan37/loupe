import type { StemPlaybackEngine, StemSeparator } from '@app/core'
import { useMemo } from 'react'
import { createWebAudioStemPlayback } from '../../audio/web-audio-stem-playback.ts'
import { useMixer } from '../mixer/use-mixer.ts'
import { useSeparation } from '../separation/use-separation.ts'

/**
 * The stem playback stack: one engine shared by the mixer (gains + loading) and
 * the transport, the separation flow (its buffers are the stems' only retained
 * PCM — zero-copy export/save), and the mixer. Plus two derived flags:
 * `stemsReady` (a separation produced stems — drives the export + what a save
 * persists) and `stemsActive` (the mixer holds any stem — the metronome can
 * join without a separation, so this is NOT the same as `stemsReady`).
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
    stemsReady: separation.state.status === 'ready',
    stemsActive: mixer.channels.length > 0
  }
}
