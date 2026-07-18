import {
  type Command,
  defaultKeyBindings,
  type KeyBindings,
  resolveCommand
} from '@app/core'
import { useEffect, useRef } from 'react'

/**
 * Don't hijack keys while the user is typing into a field. Buttons are
 * deliberately NOT here: a focused control button (e.g. just-clicked "Importer"
 * or a zoom/marker button) must not swallow the shortcut. Because a bound key
 * calls `preventDefault()`, the button's own Space/Enter activation is cancelled,
 * so there is no double trigger.
 */
const TEXT_ENTRY_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/** True when focus sits in a field where the key is meant as literal input. */
function isTextEntry(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (TEXT_ENTRY_TAGS.has(target.tagName) || target.isContentEditable)
  )
}

/**
 * True while a modal dialog owns the interaction. Its focus trap keeps the
 * pressed key targeting the dialog subtree, so this is checkable from the
 * event alone — the global layout must not mutate the session behind an
 * overlay (e.g. T retapping the tempo behind the very dialog listing it).
 */
function isInsideDialog(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && target.closest('[role="dialog"]') !== null
  )
}

/** The app actions a resolved command is dispatched onto. */
export interface ShortcutActions {
  readonly togglePlayback: () => void
  /** One musical seek step: a beat, a measure when coarse (Shift) — the
   * shell resolves the actual jump against the session's beat grid. */
  readonly seekStep: (direction: -1 | 1, coarse: boolean) => void
  readonly zoomIn: () => void
  readonly zoomOut: () => void
  readonly addMarker: () => void
  /** Drop a hand-laid STRUCTURE marker at the playhead (Shift+M). */
  readonly addSectionMarker: () => void
  /** Loop the active A/B region vs playing through it. */
  readonly toggleLoop: () => void
  /** Mute/unmute the metronome click lane. */
  readonly toggleMetronome: () => void
  /** One tap of the manual tap-tempo (the median of a run sets the BPM). */
  readonly tapTempo: () => void
  /** Persist the session (Cmd/Ctrl+S) — the shell decides name and no-ops. */
  readonly saveProject: () => void
}

export interface ShortcutOptions {
  /** When false the listener is detached (e.g. no track loaded). */
  readonly enabled?: boolean
  /** Override the shipped layout — defaults to `defaultKeyBindings`. */
  readonly bindings?: KeyBindings
}

function dispatch(command: Command, actions: ShortcutActions): void {
  switch (command.type) {
    case 'togglePlayback':
      actions.togglePlayback()
      return
    case 'seekStep':
      actions.seekStep(command.direction, command.coarse)
      return
    case 'zoomIn':
      actions.zoomIn()
      return
    case 'zoomOut':
      actions.zoomOut()
      return
    case 'addMarker':
      actions.addMarker()
      return
    case 'addSectionMarker':
      actions.addSectionMarker()
      return
    case 'toggleLoop':
      actions.toggleLoop()
      return
    case 'toggleMetronome':
      actions.toggleMetronome()
      return
    case 'tapTempo':
      actions.tapTempo()
      return
    case 'saveProject':
      actions.saveProject()
      return
  }
}

/**
 * Smart adapter: a single global keydown listener that resolves each chord
 * through the pure `KeyBindings` and dispatches the command onto the app
 * actions. The handler reads the latest actions through a ref, so it is
 * registered once and never closes over a stale position/transport.
 */
export function useKeyboardShortcuts(
  actions: ShortcutActions,
  options: ShortcutOptions = {}
): void {
  const { enabled = true, bindings = defaultKeyBindings } = options

  const actionsRef = useRef(actions)
  useEffect(() => {
    actionsRef.current = actions
  })

  useEffect(() => {
    if (!enabled) {
      return
    }
    function onKeyDown(event: KeyboardEvent): void {
      // A control that owns the key consumed it first (a marker tag or a loop
      // handle arrow-nudge calls preventDefault): the global layout stands back.
      // Auto-repeat is ignored too — a held key fires its command once, not at
      // the OS repeat rate (a held T would machine-gun the tap tempo).
      // A Cmd/Ctrl chord is never literal text (AltGr — ctrl+alt — is), so a
      // command chord fires even from a field: Cmd+S must save, not summon the
      // browser's own Save-page over the chord-grid textarea.
      const commandChord = (event.metaKey || event.ctrlKey) && !event.altKey
      if (
        event.defaultPrevented ||
        event.repeat ||
        (isTextEntry(event.target) && !commandChord) ||
        isInsideDialog(event.target)
      ) {
        return
      }
      const command = resolveCommand(bindings, {
        code: event.code,
        key: event.key,
        shift: event.shiftKey,
        ctrl: event.ctrlKey,
        alt: event.altKey,
        meta: event.metaKey
      })
      if (!command) {
        return
      }
      event.preventDefault()
      dispatch(command, actionsRef.current)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, bindings])
}
