# Session — 2026-06-28 — jalon1-shortcuts-help-and-layout-fix

Follow-up on Slice 7 (same branch / PR #13). The keyboard shortcuts shipped with
no in-app discoverability, and in-browser use surfaced two layout/focus bugs.

## Done
- **In-app shortcuts help.** Pure `describeKeyBindings` (web layer, French labels)
  *derives* the help rows straight from the active `KeyBindings`, so the
  documentation can never drift from what the keys actually do —
  [shortcut-hints.ts](../../packages/web/src/app/keyboard/shortcut-hints.ts)
  (+ spec). Dumb `ShortcutsDialog` (Base UI Dialog, controlled by the shell) and a
  "?" trigger button in the header.
- **Fix — shortcuts swallowed while a control button holds focus.** The listener
  guard treated `BUTTON` as "interactive" and bailed; after clicking *Importer* /
  zoom / marker, focus stayed on that button and ate every shortcut. Guard now
  only blocks genuine text entry (INPUT/TEXTAREA/SELECT/contenteditable). The
  existing `preventDefault()` on a bound key cancels the button's own Space/Enter
  activation, so there is no double trigger —
  [use-keyboard-shortcuts.ts](../../packages/web/src/app/keyboard/use-keyboard-shortcuts.ts).
- **Fix — layout-wrong keys (`+`/`−` dead, `,` added a marker instead of `m`).**
  Bindings matched by physical `KeyboardEvent.code`; on AZERTY the physical `KeyM`
  types `,`, and `+` (= Shift+Equal) never matched a bare `Equal`. Introduced a
  two-mode `KeyChord` in the pure core: spatial keys (Space, arrows) keep matching
  by `code`; mnemonic keys (`+`, `-`, `M`) now match by **character** (`key`),
  case-insensitively and Shift-agnostically. Ctrl/Cmd still excluded, so browser
  zoom (`Ctrl/Cmd +`) is never hijacked —
  [key-bindings.ts](../../packages/core/src/domain/key-bindings.ts).
- Regression tests added: shortcut fires with a button focused; no fire while
  typing in a field; `+`/`-` zoom and `m` marker are layout-independent; browser
  zoom chords pass through.

## Not done / remaining
- No keyboard trigger for the help dialog itself (the "?" key is layout-awkward on
  AZERTY); opened via the header button only. Acceptable; revisit if requested.
- Pre-existing CSS clone (`.header` ≈ `.bar`, jscpd, non-blocking) left as-is.

## Decisions
- **Locale lives in the web layer, not the core.** French shortcut labels are
  derived in `packages/web` (matching the existing marker-label precedent); the
  pure core stays language-neutral.
- **Key-binding match strategy is per-key, by intent.** Spatial keys → physical
  `code` (layout-stable); mnemonic letters/symbols → typed `key` (layout-correct).
  This is the durable rule behind the AZERTY fix.

## Gate status
- typecheck: ✅
- tests (with coverage): ✅ 155 passed (25 files)
- mutation (Stryker, local — core touched): ✅ overall 96.26%; **`key-bindings.ts`
  100% (71/71 killed, 0 survived)**. Surviving mutants are all in pre-existing
  files (transport/pitch/playback-rate/…), untouched by this step.
- biome / sheriff / knip / jscpd / impeccable / react-doctor: ✅ (jscpd reports 1
  pre-existing CSS clone, non-blocking — exit 0)

## State to resume from
- **Single next action**: merge **PR #13** (`feat/jalon1-keyboard-shortcuts`) to
  close Jalon 1.
- Gotchas / half-done edits: none. Branch is gate-green with this follow-up
  committed; PR #13 updated in place (no new PR).
