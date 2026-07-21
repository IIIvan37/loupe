import {
  type BeatGrid,
  seekStepSeconds,
  stepPitchSemitones,
  stepTempoPercent
} from '@app/core'
import type { ExternalValue } from '../../lib/external-value.ts'
import { useKeyboardShortcuts } from '../keyboard/use-keyboard-shortcuts.ts'
import type { Markers } from '../markers/use-markers.ts'
import type { CountInTransport } from '../tempo/use-count-in.ts'
import type { Metronome } from '../tempo/use-metronome.ts'
import type { ViewportControl } from '../waveform/use-viewport.ts'
import { useNativeMenu } from './use-native-menu.ts'
import type { ProjectSession } from './use-project-session.ts'
import type { TempoDetection } from './use-tempo-detection.ts'

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
  /** Open the file picker — the native menu's Fichier → Importer routes here. */
  readonly openImport: () => void
  /** Reveal the shortcuts dialog — the native menu's Aide item routes here. */
  readonly openShortcuts: () => void
  readonly countIn: Pick<CountInTransport, 'togglePlayback'>
  readonly position: Pick<ExternalValue<number>, 'get'>
  readonly seekToSeconds: (seconds: number) => void
  /** The session's beat grid — empty without one (fixed-hop seek). */
  readonly grid: BeatGrid
  readonly viewport: Pick<ViewportControl, 'zoomIn' | 'zoomOut'>
  /** Playback speed as a whole percent + its setter (the `[`/`]` steps). */
  readonly speed: {
    readonly percent: number
    readonly setPercent: (percent: number) => void
  }
  /** Pitch in whole semitones + its setter (the `{`/`}` steps). */
  readonly pitch: {
    readonly semitones: number
    readonly setSemitones: (semitones: number) => void
  }
  readonly markers: Pick<Markers, 'addAt' | 'addSectionAt'>
  readonly toggleLoop: () => void
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
  openImport,
  openShortcuts,
  countIn,
  position,
  seekToSeconds,
  grid,
  viewport,
  speed,
  pitch,
  markers,
  toggleLoop,
  metronome,
  tempoDetection,
  session
}: ShellShortcutsDeps): void {
  const saveProject = () => guardedProjectSave(session)
  // The native macOS menu bar (desktop shell) routes onto the same handlers.
  useNativeMenu({
    import: openImport,
    save: saveProject,
    shortcuts: openShortcuts
  })
  useKeyboardShortcuts(
    {
      togglePlayback: countIn.togglePlayback,
      seekStep: (direction, coarse) =>
        seekToSeconds(seekStepSeconds(position.get(), direction, grid, coarse)),
      zoomIn: viewport.zoomIn,
      zoomOut: viewport.zoomOut,
      stepTempo: (direction) =>
        speed.setPercent(stepTempoPercent(speed.percent, direction)),
      stepPitch: (direction) =>
        pitch.setSemitones(stepPitchSemitones(pitch.semitones, direction)),
      addMarker: () => markers.addAt(position.get()),
      addSectionMarker: () => markers.addSectionAt(position.get()),
      toggleLoop,
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
