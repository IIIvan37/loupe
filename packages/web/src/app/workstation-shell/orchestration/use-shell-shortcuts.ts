import {
  type BeatGrid,
  percent,
  percentToRatio,
  ratio,
  ratioToPercent,
  seekStepSeconds,
  stepPitchSemitones,
  stepTempoPercent
} from '@app/core'
import { useAtomValue } from 'jotai'
import type { PlayerHandle } from '../../audio-session/audio-session.ts'
import { useKeyboardShortcuts } from '../../keyboard/use-keyboard-shortcuts.ts'
import type { Markers } from '../../markers/use-markers.ts'
import type { CountInTransport } from '../../tempo/use-count-in.ts'
import type { Metronome } from '../../tempo/use-metronome.ts'
import type { TempoDetection } from '../../tempo/use-tempo-detection.ts'
import {
  pitchSemitonesAtom,
  timeRatioAtom
} from '../../waveform/player-atoms.ts'
import { useViewport } from '../../waveform/use-viewport.ts'
import type { ProjectSession } from './use-project-session.ts'

/** The session slice the Cmd/Ctrl+S save reads and drives. */
export type SaveSession = Pick<
  ProjectSession,
  | 'projects'
  | 'preparingSave'
  | 'currentProject'
  | 'dirty'
  | 'trackName'
  | 'handleSave'
>

/** The slice of each shell hook the keyboard layout drives. */
interface ShellShortcutsDeps {
  /** When false the listener is detached (e.g. no track loaded). */
  readonly enabled: boolean
  readonly countIn: Pick<CountInTransport, 'togglePlayback'>
  /** The player's verbs the layout drives — the playhead it seeks from, the
   * loupe it toggles, the tempo and pitch it steps. The VALUES it steps from
   * are the player's atoms, read below (ADR 0010). */
  readonly player: Pick<
    PlayerHandle,
    | 'position'
    | 'seekToSeconds'
    | 'toggleLoop'
    | 'setTimeRatio'
    | 'setPitchSemitones'
  >
  /** The session's beat grid — empty without one (fixed-hop seek). */
  readonly grid: BeatGrid
  readonly markers: Pick<Markers, 'addAt' | 'addSectionAt'>
  readonly metronome: Pick<Metronome, 'toggle'>
  readonly tempoDetection: Pick<TempoDetection, 'tap'>
  /** The project session Cmd/Ctrl+S persists. */
  readonly session: SaveSession
}

/**
 * Wire the global keyboard layout onto the shell's hooks: transport, seek,
 * zoom, markers, and the practice toggles (loop, metronome click, tap tempo).
 */
export function useShellShortcuts({
  enabled,
  countIn,
  player,
  grid,
  markers,
  metronome,
  tempoDetection,
  session
}: ShellShortcutsDeps): void {
  // The zoom the layout steps is the viewport feature's own atom (ADR 0010) —
  // this hook wears it instead of the shell handing an instance down.
  const viewport = useViewport()
  // The tempo and pitch a step starts from are the player's own atoms — the
  // shell no longer hands them down (ADR 0010).
  const timeRatio = useAtomValue(timeRatioAtom)
  const pitchSemitones = useAtomValue(pitchSemitonesAtom)
  const tempoPercent = Math.round(ratioToPercent(ratio(timeRatio)))
  const saveProject = () => guardedProjectSave(session)
  useKeyboardShortcuts(
    {
      togglePlayback: countIn.togglePlayback,
      seekStep: (direction, coarse) =>
        player.seekToSeconds(
          seekStepSeconds(player.position.get(), direction, grid, coarse)
        ),
      zoomIn: viewport.zoomIn,
      zoomOut: viewport.zoomOut,
      stepTempo: (direction) =>
        player.setTimeRatio(
          percentToRatio(percent(stepTempoPercent(tempoPercent, direction)))
        ),
      stepPitch: (direction) =>
        player.setPitchSemitones(stepPitchSemitones(pitchSemitones, direction)),
      addMarker: () => markers.addAt(player.position.get()),
      addSectionMarker: () => markers.addSectionAt(player.position.get()),
      toggleLoop: player.toggleLoop,
      toggleMetronome: metronome.toggle,
      tapTempo: tempoDetection.tap,
      saveProject
    },
    { enabled }
  )
}

/**
 * The one guarded save both Cmd/Ctrl+S and the native File menu drive: a
 * first save lands under the track's name (the popover's own seed) and a
 * dirty project re-saves under its name; a clean project or an in-flight
 * save no-ops — never a redundant stems re-encode.
 */
export function guardedProjectSave(session: SaveSession): void {
  if (session.projects.busy === 'save' || session.preparingSave) {
    return
  }
  if (session.currentProject !== undefined && !session.dirty) {
    return
  }
  session.handleSave(session.currentProject?.name ?? session.trackName ?? '')
}
