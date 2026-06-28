import type { Command, KeyBindings, KeyChord } from '@app/core'

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

/** Readable glyphs for the named (non-letter) physical codes we bind. */
const CODE_GLYPHS: Readonly<Record<string, string>> = {
  Space: 'Espace',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Equal: '+',
  Minus: '−',
  Enter: 'Entrée',
  Escape: 'Échap'
}

/** The visible key for a chord's physical code (layout-independent). */
function codeLabel(code: string): string {
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

/** French sentence describing what a resolved command does. */
function describeCommand(command: Command): string {
  switch (command.type) {
    case 'togglePlayback':
      return 'Lecture / Pause'
    case 'seekBy':
      return command.seconds < 0
        ? `Reculer de ${Math.abs(command.seconds)} s`
        : `Avancer de ${command.seconds} s`
    case 'zoomIn':
      return 'Zoom avant'
    case 'zoomOut':
      return 'Zoom arrière'
    case 'addMarker':
      return 'Ajouter un repère'
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
