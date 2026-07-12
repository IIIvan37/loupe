import type { Command, KeyBindings, KeyChord } from '@app/core'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { i18n } from '../../i18n/i18n.ts'

/** One row in the shortcuts help: the key glyph(s) and what they do. */
export interface ShortcutHint {
  readonly keys: string
  readonly description: string
}

/** Held-modifier glyphs, rendered in a stable ⌘ ⌥ ⇧ ⌃ order. */
const MODIFIERS: ReadonlyArray<{
  readonly held: keyof KeyChord
  readonly glyph: string
}> = [
  { held: 'meta', glyph: '⌘' },
  { held: 'alt', glyph: '⌥' },
  { held: 'shift', glyph: '⇧' },
  { held: 'ctrl', glyph: '⌃' }
]

/** Locale-neutral glyphs for the named (non-letter) physical codes we bind. */
const CODE_GLYPHS: Readonly<Record<string, string>> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Equal: '+',
  Minus: '−'
}

/** Translatable names for the physical codes whose label is a word. */
const CODE_NAMES: Readonly<Record<string, MessageDescriptor>> = {
  Space: msg({ id: 'shortcuts.key-space', message: 'Espace' }),
  Enter: msg({ id: 'shortcuts.key-enter', message: 'Entrée' }),
  Escape: msg({ id: 'shortcuts.key-escape', message: 'Échap' })
}

/** The visible key for a chord's physical code (layout-independent). */
function codeLabel(code: string): string {
  const named = CODE_NAMES[code]
  if (named !== undefined) {
    return i18n._(named)
  }
  const glyph = CODE_GLYPHS[code]
  if (glyph !== undefined) {
    return glyph
  }
  if (code.startsWith('Key')) {
    return code.slice(3)
  }
  if (code.startsWith('Digit')) {
    return code.slice(5)
  }
  return code
}

/** The visible key for a chord: its character (upper-cased) or its code glyph. */
function keyLabel(chord: KeyChord): string {
  if (chord.key !== undefined) {
    return chord.key.toUpperCase()
  }
  return chord.code === undefined ? '' : codeLabel(chord.code)
}

/** A chord as a human string, e.g. `⌘ + ⇧ + +` or `Espace`. */
function formatChord(chord: KeyChord): string {
  const parts = MODIFIERS.flatMap((modifier) =>
    chord[modifier.held] ? [modifier.glyph] : []
  )
  parts.push(keyLabel(chord))
  return parts.join(' + ')
}

const PLAY_PAUSE = msg({
  id: 'shortcuts.play-pause',
  message: 'Lecture / Pause'
})
const SEEK_BACK = msg({
  id: 'shortcuts.seek-back',
  message: 'Reculer de {seconds} s'
})
const SEEK_FORWARD = msg({
  id: 'shortcuts.seek-forward',
  message: 'Avancer de {seconds} s'
})
const ZOOM_IN = msg({ id: 'shortcuts.zoom-in', message: 'Zoom avant' })
const ZOOM_OUT = msg({ id: 'shortcuts.zoom-out', message: 'Zoom arrière' })
const ADD_MARKER = msg({
  id: 'shortcuts.add-marker',
  message: 'Ajouter un repère'
})
const TOGGLE_LOOP = msg({
  id: 'shortcuts.toggle-loop',
  message: 'Activer / désactiver la boucle'
})
const TOGGLE_METRONOME = msg({
  id: 'shortcuts.toggle-metronome',
  message: 'Activer / désactiver le métronome'
})
// Same action as the tempo panel's tap button — same words, same catalogue id.
const TAP_TEMPO = msg({ id: 'tempo.tap', message: 'Taper le tempo' })

/** Localised sentence describing what a resolved command does. */
function describeCommand(command: Command): string {
  switch (command.type) {
    case 'togglePlayback':
      return i18n._(PLAY_PAUSE)
    case 'seekBy': {
      const descriptor = command.seconds < 0 ? SEEK_BACK : SEEK_FORWARD
      const seconds = Math.abs(command.seconds)
      // The macro always emits a message; the fallback only satisfies the types.
      const message = descriptor.message ?? descriptor.id
      return i18n._(descriptor.id, { seconds }, { message })
    }
    case 'zoomIn':
      return i18n._(ZOOM_IN)
    case 'zoomOut':
      return i18n._(ZOOM_OUT)
    case 'addMarker':
      return i18n._(ADD_MARKER)
    case 'toggleLoop':
      return i18n._(TOGGLE_LOOP)
    case 'toggleMetronome':
      return i18n._(TOGGLE_METRONOME)
    case 'tapTempo':
      return i18n._(TAP_TEMPO)
  }
}

/**
 * Derive the in-app shortcuts help straight from the active bindings, so the
 * documentation can never drift from what the keyboard actually does.
 */
export function describeKeyBindings(bindings: KeyBindings): ShortcutHint[] {
  return bindings.map((binding) => ({
    keys: formatChord(binding.chord),
    description: describeCommand(binding.command)
  }))
}
