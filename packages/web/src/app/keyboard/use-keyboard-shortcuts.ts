import {
  type Command,
  defaultKeyBindings,
  type KeyBindings,
  type MarkerKind,
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

/** The app actions a resolved command is dispatched onto. */
export interface ShortcutActions {
  readonly togglePlayback: () => void
  /** Seek by a signed delta in seconds, relative to the current position. */
  readonly seekBy: (seconds: number) => void
  readonly zoomIn: () => void
  readonly zoomOut: () => void
  readonly addMarker: (kind: MarkerKind) => void
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
    case 'seekBy':
      actions.seekBy(command.seconds)
      return
    case 'zoomIn':
      actions.zoomIn()
      return
    case 'zoomOut':
      actions.zoomOut()
      return
    case 'addMarker':
      actions.addMarker(command.kind)
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
      if (isTextEntry(event.target)) {
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
