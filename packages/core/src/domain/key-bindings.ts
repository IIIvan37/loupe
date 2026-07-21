/**
 * A keyboard chord identified one of two ways:
 *
 * - `code` — a physical key position (`KeyboardEvent.code`), layout-independent.
 *   Right for spatial keys (Space, arrows). Its `shift` is matched exactly.
 * - `key` — the produced character (`KeyboardEvent.key`). Right for mnemonic
 *   keys (letters, `+`, `-`): on AZERTY the physical `KeyM` types `,`, so we
 *   bind the character the user actually means. Matched case-insensitively and
 *   shift-agnostically, since the character already encodes Shift.
 *
 * The remaining modifiers (`ctrl`/`alt`/`meta`) always default to "must NOT be
 * held" for both forms, so browser/OS chords (Cmd+Space, Ctrl++) are never
 * hijacked.
 */
export interface KeyChord {
  readonly code?: string
  readonly key?: string
  readonly shift?: boolean
  readonly ctrl?: boolean
  readonly alt?: boolean
  readonly meta?: boolean
}

/**
 * An app intent resolved from a chord. Pure data — the web adapter maps each
 * one onto a smart-hook call (toggle, seek, zoom, add marker). `seekStep`
 * carries a direction and a coarseness; the adapter resolves the actual jump
 * (a beat, a bar with `coarse`, the fixed hop without a grid) against the
 * session's beat grid via `seekStepSeconds`.
 */
export type Command =
  | { readonly type: 'togglePlayback' }
  | {
      readonly type: 'seekStep'
      readonly direction: -1 | 1
      readonly coarse: boolean
    }
  | { readonly type: 'zoomIn' }
  | { readonly type: 'zoomOut' }
  | { readonly type: 'tempoStep'; readonly direction: -1 | 1 }
  | { readonly type: 'pitchStep'; readonly direction: -1 | 1 }
  | { readonly type: 'addMarker' }
  | { readonly type: 'addSectionMarker' }
  | { readonly type: 'toggleLoop' }
  | { readonly type: 'toggleMetronome' }
  | { readonly type: 'tapTempo' }
  | { readonly type: 'saveProject' }

export interface KeyBinding {
  readonly chord: KeyChord
  readonly command: Command
}

export type KeyBindings = ReadonlyArray<KeyBinding>

/** Seconds skipped by a single arrow-key seek when no beat grid exists. */
export const SEEK_STEP_SECONDS = 5

/**
 * The shipped layout. Spatial keys bind by physical position; the mnemonic
 * keys (`+`, `-`, `M`, `L`, `K`, `T`) bind by character so they land on the right key on every
 * keyboard layout. All are modifier-free, so they never clash with browser
 * shortcuts (which all carry Ctrl/Cmd).
 */
export const defaultKeyBindings: KeyBindings = [
  { chord: { code: 'Space' }, command: { type: 'togglePlayback' } },
  // Musical seek: a beat per arrow, a measure with Shift (a code binding
  // matches Shift exactly, so the bare and shifted chords are distinct).
  {
    chord: { code: 'ArrowLeft' },
    command: { type: 'seekStep', direction: -1, coarse: false }
  },
  {
    chord: { code: 'ArrowRight' },
    command: { type: 'seekStep', direction: 1, coarse: false }
  },
  {
    chord: { code: 'ArrowLeft', shift: true },
    command: { type: 'seekStep', direction: -1, coarse: true }
  },
  {
    chord: { code: 'ArrowRight', shift: true },
    command: { type: 'seekStep', direction: 1, coarse: true }
  },
  { chord: { key: '+' }, command: { type: 'zoomIn' } },
  { chord: { key: '-' }, command: { type: 'zoomOut' } },
  // Practice speed/pitch (AL.3): the brackets slow down / speed up, their
  // shifted variants ({ }) transpose. Bound by character so they land on the
  // right keys on every layout, and { / } are distinct characters from [ / ]
  // so a plain bracket never fires the pitch command.
  { chord: { key: '[' }, command: { type: 'tempoStep', direction: -1 } },
  { chord: { key: ']' }, command: { type: 'tempoStep', direction: 1 } },
  { chord: { key: '{' }, command: { type: 'pitchStep', direction: -1 } },
  { chord: { key: '}' }, command: { type: 'pitchStep', direction: 1 } },
  // Declared shift, and listed BEFORE the bare `m`: a character binding is
  // shift-agnostic unless it says otherwise, so order decides Shift+M.
  { chord: { key: 'm', shift: true }, command: { type: 'addSectionMarker' } },
  { chord: { key: 'm' }, command: { type: 'addMarker' } },
  { chord: { key: 'l' }, command: { type: 'toggleLoop' } },
  { chord: { key: 'k' }, command: { type: 'toggleMetronome' } },
  { chord: { key: 't' }, command: { type: 'tapTempo' } },
  // The one modifier chord: the accepted web-workshop standard (Figma, Docs)
  // for « save », hijacking the browser's own Save-page. Meta and Ctrl each
  // get a binding so macOS and Windows/Linux both land on it.
  { chord: { key: 's', meta: true }, command: { type: 'saveProject' } },
  { chord: { key: 's', ctrl: true }, command: { type: 'saveProject' } }
]

/** Ctrl/alt/meta must match exactly so OS/browser chords are never hijacked. */
function commandModifiersMatch(chord: KeyChord, pressed: KeyChord): boolean {
  return (
    Boolean(chord.ctrl) === Boolean(pressed.ctrl) &&
    Boolean(chord.alt) === Boolean(pressed.alt) &&
    Boolean(chord.meta) === Boolean(pressed.meta)
  )
}

function chordMatches(chord: KeyChord, pressed: KeyChord): boolean {
  if (!commandModifiersMatch(chord, pressed)) {
    return false
  }
  if (chord.key !== undefined) {
    // Character match: case-insensitive. Shift is normally part of the
    // character (a `+` binding must match however the layout produces it),
    // so it only discriminates when the binding DECLARES it — the opt-in
    // that lets Shift+M mean something else than M.
    if (
      chord.shift !== undefined &&
      Boolean(chord.shift) !== Boolean(pressed.shift)
    ) {
      return false
    }
    return pressed.key?.toLowerCase() === chord.key.toLowerCase()
  }
  // Physical-position match: Shift distinguishes a bare key from its variant.
  return (
    chord.code === pressed.code &&
    Boolean(chord.shift) === Boolean(pressed.shift)
  )
}

/**
 * The command a pressed chord triggers, or `undefined` when nothing is bound.
 * Character bindings match the typed key (layout-correct); code bindings match
 * the physical position. Either way a bare key and its Ctrl/Alt/Cmd variant are
 * distinct, so OS chords pass through untouched.
 */
export function resolveCommand(
  bindings: KeyBindings,
  pressed: KeyChord
): Command | undefined {
  return bindings.find((binding) => chordMatches(binding.chord, pressed))
    ?.command
}
