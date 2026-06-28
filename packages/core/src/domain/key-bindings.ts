import type { MarkerKind } from './marker.ts'

/**
 * A keyboard chord: a physical key (`KeyboardEvent.code`, layout-independent)
 * plus the modifiers that must be held. Absent modifiers mean "must NOT be
 * held" — a binding for `Space` does not fire when `Cmd+Space` is pressed, so
 * browser/OS chords are never hijacked.
 */
export interface KeyChord {
  readonly code: string
  readonly shift?: boolean
  readonly ctrl?: boolean
  readonly alt?: boolean
  readonly meta?: boolean
}

/**
 * An app intent resolved from a chord. Pure data — the web adapter maps each
 * one onto a smart-hook call (toggle, seek, zoom, add marker). `seekBy` carries
 * a signed delta in seconds; the adapter adds it to the current position.
 */
export type Command =
  | { readonly type: 'togglePlayback' }
  | { readonly type: 'seekBy'; readonly seconds: number }
  | { readonly type: 'zoomIn' }
  | { readonly type: 'zoomOut' }
  | { readonly type: 'addMarker'; readonly kind: MarkerKind }

export interface KeyBinding {
  readonly chord: KeyChord
  readonly command: Command
}

export type KeyBindings = ReadonlyArray<KeyBinding>

/** Seconds skipped by a single arrow-key seek. */
export const SEEK_STEP_SECONDS = 5

/**
 * The shipped layout. Modifier-free single keys so they stay discoverable and
 * never clash with browser shortcuts (which all carry a modifier).
 */
export const defaultKeyBindings: KeyBindings = [
  { chord: { code: 'Space' }, command: { type: 'togglePlayback' } },
  {
    chord: { code: 'ArrowLeft' },
    command: { type: 'seekBy', seconds: -SEEK_STEP_SECONDS }
  },
  {
    chord: { code: 'ArrowRight' },
    command: { type: 'seekBy', seconds: SEEK_STEP_SECONDS }
  },
  { chord: { code: 'Equal' }, command: { type: 'zoomIn' } },
  { chord: { code: 'Minus' }, command: { type: 'zoomOut' } },
  { chord: { code: 'KeyM' }, command: { type: 'addMarker', kind: 'section' } }
]

function modifiersMatch(chord: KeyChord, pressed: KeyChord): boolean {
  return (
    Boolean(chord.shift) === Boolean(pressed.shift) &&
    Boolean(chord.ctrl) === Boolean(pressed.ctrl) &&
    Boolean(chord.alt) === Boolean(pressed.alt) &&
    Boolean(chord.meta) === Boolean(pressed.meta)
  )
}

/**
 * The command a pressed chord triggers, or `undefined` when nothing is bound.
 * Matching is exact on code AND every modifier, so a bare key and its modified
 * variant are distinct bindings.
 */
export function resolveCommand(
  bindings: KeyBindings,
  pressed: KeyChord
): Command | undefined {
  return bindings.find(
    (binding) =>
      binding.chord.code === pressed.code &&
      modifiersMatch(binding.chord, pressed)
  )?.command
}
