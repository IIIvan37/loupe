# Session — 2026-06-28 — jalon1-keyboard-shortcuts

## Done
- **Slice 7 — keyboard shortcuts** (last slice of Jalon 1), outside-in.
- Pure core domain `packages/core/src/domain/key-bindings.ts`: a `KeyChord`
  (code + modifiers) → `Command` map. `resolveCommand(bindings, chord)` matches
  **exactly** on code AND every modifier (absent modifier ≡ must-not-be-held), so
  bare keys never hijack browser/OS chords (Cmd+Space, Ctrl+→…). `defaultKeyBindings`:
  Space → toggle, ←/→ → seek ∓`SEEK_STEP_SECONDS` (5 s), `=`/`-` → zoom in/out,
  `M` → add section marker. Exported from `index.ts`.
- Web adapter `packages/web/src/app/keyboard/use-keyboard-shortcuts.ts`: a single
  global `keydown` listener that resolves the chord through the pure core and
  dispatches the command onto the smart hooks. Reads the latest actions via a ref
  (no stale position/transport), skips `INTERACTIVE_TAGS` focus, `enabled`-gated.
- Folded the old bespoke Space `useEffect` in `workstation-shell.tsx` into the
  hook; shortcuts gated on track-loaded (`enabled: isLoaded`). Only `preventDefault`
  when a command actually resolves (lets unbound keys reach the browser).
- a11y baseline already present globally (`:focus-visible` outline +
  `prefers-reduced-motion` reduce) — no new CSS needed.
- Registered the new pure domain in `packages/core/src/application/README.md`.
- Tests: `key-bindings.spec.ts` (exact-match, per-modifier rejection via
  `it.each`, first-match, fast-check property) + 4 new `workstation-shell.spec.tsx`
  cases (ignored-until-loaded, arrow seek, M-marker, modified-chord left alone).

## Not done / remaining
- Jalon 1 is now feature-complete (Slices 0–7). No further J1 slice.
- The `cli` example package is still present (noted in STATUS as removable once
  redundant) — out of scope here.

## Decisions
- Keyboard mapping lives as **pure domain** (no port, UI-driven) — same shape as
  zoom/markers/transport. The global listener is the adapter; the `Command` union
  is the contract the consumer (listener) pins on the supplier (core).
- Shipped layout is **modifier-free single keys** by design (discoverable, never
  clash with modifier-bearing browser shortcuts). `=`/`-` (not `+`) chosen so no
  Shift is required.

## Gate status
- typecheck: ✅
- tests (with coverage): ✅ 142 tests pass; core coverage thresholds hold
- mutation (Stryker, local, core touched): ✅ all files 96.11%; `key-bindings.ts`
  **100%** (after adding per-modifier `it.each` to kill the `alt`-comparison mutant)
- biome / sheriff / knip / jscpd: ✅ `pnpm gate` EXIT=0 (only pre-existing
  header/transport-bar CSS clone, under threshold)

## State to resume from
- **Single next action**: push `feat/jalon1-keyboard-shortcuts`, open the PR,
  merge it — closes Jalon 1.
- Gotchas / half-done edits: none. IDE shows SonarLint hints (prefer `globalThis`
  over `window`, `Set` over array for `INTERACTIVE_TAGS`) in the new hook — these
  match the existing codebase idioms and are NOT enforced by `pnpm gate`; left
  as-is for consistency.
