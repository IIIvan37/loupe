import type { ExternalValue } from '../../lib/external-value.ts'
import { useKeyboardShortcuts } from '../keyboard/use-keyboard-shortcuts.ts'
import type { Markers } from '../markers/use-markers.ts'
import type { CountInTransport } from '../tempo/use-count-in.ts'
import type { Metronome } from '../tempo/use-metronome.ts'
import type { ViewportControl } from '../waveform/use-viewport.ts'
import type { TempoDetection } from './use-tempo-detection.ts'

/** The slice of each shell hook the keyboard layout drives. */
interface ShellShortcutsDeps {
  /** When false the listener is detached (e.g. no track loaded). */
  readonly enabled: boolean
  readonly countIn: Pick<CountInTransport, 'togglePlayback'>
  readonly position: Pick<ExternalValue<number>, 'get'>
  readonly seekToSeconds: (seconds: number) => void
  readonly viewport: Pick<ViewportControl, 'zoomIn' | 'zoomOut'>
  readonly markers: Pick<Markers, 'addAt'>
  readonly toggleLoop: () => void
  readonly metronome: Pick<Metronome, 'toggle'>
  readonly tempoDetection: Pick<TempoDetection, 'tap'>
}

/**
 * Wire the global keyboard layout onto the shell's hooks: transport, seek,
 * zoom, markers, and the practice toggles (loop, metronome click, tap tempo).
 */
export function useShellShortcuts({
  enabled,
  countIn,
  position,
  seekToSeconds,
  viewport,
  markers,
  toggleLoop,
  metronome,
  tempoDetection
}: ShellShortcutsDeps): void {
  useKeyboardShortcuts(
    {
      togglePlayback: countIn.togglePlayback,
      seekBy: (seconds) => seekToSeconds(position.get() + seconds),
      zoomIn: viewport.zoomIn,
      zoomOut: viewport.zoomOut,
      addMarker: () => markers.addAt(position.get()),
      toggleLoop,
      toggleMetronome: metronome.toggle,
      tapTempo: tempoDetection.tap
    },
    { enabled }
  )
}
