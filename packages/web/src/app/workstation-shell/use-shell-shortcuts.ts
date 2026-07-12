import { useKeyboardShortcuts } from '../keyboard/use-keyboard-shortcuts.ts'
import { METRONOME_ID } from '../tempo/metronome-stem.ts'

/** The narrow slice of each shell hook the keyboard layout drives. */
interface ShellShortcutsDeps {
  /** When false the listener is detached (e.g. no track loaded). */
  readonly enabled: boolean
  readonly countIn: { readonly togglePlayback: () => void }
  readonly position: { readonly get: () => number }
  readonly seekToSeconds: (seconds: number) => void
  readonly viewport: {
    readonly zoomIn: () => void
    readonly zoomOut: () => void
  }
  readonly markers: { readonly addAt: (seconds: number) => void }
  readonly toggleLoop: () => void
  readonly mixer: { readonly toggleMute: (id: string) => void }
  readonly tempoDetection: { readonly tap: () => void }
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
  mixer,
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
      // The click is a mixer stem: audible on/off is its channel mute.
      toggleMetronome: () => mixer.toggleMute(METRONOME_ID),
      tapTempo: tempoDetection.tap
    },
    { enabled }
  )
}
