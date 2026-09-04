import {
  formatTimecode,
  percent,
  percentToRatio,
  ratio,
  ratioToPercent
} from '@app/core'
import { useAtomValue } from 'jotai'
import { usePlayerHandle } from '../../../audio-session/audio-session.ts'
import { countingInAtom } from '../../../tempo/tempo-atoms.ts'
import {
  fineTuneCentsAtom,
  importStateAtom,
  pitchSemitonesAtom,
  timeRatioAtom,
  transportAtom
} from '../../../waveform/player-atoms.ts'
import { TransportBar } from '../../../transport-bar/transport-bar.tsx'

interface ShellFooterProps {
  /** Play/pause with the count-in in front of every start — the shell's, not
   * the region's: the same `useCountIn` instance serves the shortcuts, and a
   * second one would hold its own pending count. */
  readonly onPlayPause: () => void
}

/**
 * The transport footer: a smart region (ADR 0010/0011) that reads the player's
 * state from its feature atoms and its verbs from the session handle, instead
 * of the shell threading a dozen props down. Formatting and unit conversion
 * live here; every transition stays in the player hooks.
 */
export function ShellFooter({ onPlayPause }: ShellFooterProps) {
  const player = usePlayerHandle()
  const importState = useAtomValue(importStateAtom)
  const transport = useAtomValue(transportAtom)
  const timeRatio = useAtomValue(timeRatioAtom)
  const pitchSemitones = useAtomValue(pitchSemitonesAtom)
  const fineTuneCents = useAtomValue(fineTuneCentsAtom)
  const countingIn = useAtomValue(countingInAtom)
  const { durationSeconds } = transport

  return (
    <TransportBar
      position={player.position}
      duration={formatTimecode(durationSeconds)}
      // During the count-in the button reads « pause » — pressing it abandons
      // the count, exactly what a pause means at that instant.
      isPlaying={transport.isPlaying || countingIn}
      canPlay={importState.status === 'loaded'}
      onPlayPause={onPlayPause}
      onSeekToStart={() => player.seekToSeconds(0)}
      onSeekToEnd={() => player.seekToSeconds(durationSeconds)}
      tempoPercent={Math.round(ratioToPercent(ratio(timeRatio)))}
      pitchSemitones={pitchSemitones}
      onTempoChange={(value) => player.setTimeRatio(percentToRatio(percent(value)))}
      onPitchChange={player.setPitchSemitones}
      fineTuneCents={fineTuneCents}
      onFineTuneChange={player.setFineTuneCents}
    />
  )
}
