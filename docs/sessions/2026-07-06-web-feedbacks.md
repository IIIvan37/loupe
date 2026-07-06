# Session — 2026-07-06 — web-feedbacks (D.3)

## Done

**Lot D.3 — the missing feedbacks.** Three silent moments now confirm themselves,
plus a reusable success-toast primitive. Web-only bar one public re-export; no
domain logic added.

- **Unsupported-URL guard (inline, before the round-trip).** `isSupportedSourceUrl`
  is now on the core's public surface ([index.ts](../packages/core/src/index.ts) —
  a re-export of the existing J4.1 application policy). The URL-import popover
  ([import-menu.tsx](../packages/web/src/app/header/import-menu.tsx)) validates
  against it: a non-supported host shows an inline `role="alert"` warning
  (`--stem-vocals`, the app's attention colour), sets `aria-invalid` +
  `aria-describedby` on the field, and **disables submit** — the same predicate the
  use-case would reject on, so no doomed request ever leaves. Replaces the old
  "submit → error banner" round-trip.
- **Reusable transient toast (new primitive).** Built on **Base UI Toast**
  (`@base-ui-components/react/toast`, already installed at 1.0.0-rc.0):
  - [use-toaster.ts](../packages/web/src/app/ui/use-toaster.ts) — `useToaster()`
    owns a **per-instance** manager (`createToastManager` via `useMemo`, **not** a
    module singleton → no cross-test leakage) and exposes `notifySuccess`. The
    outside-component `add()` API lets the shell raise a toast from any success
    callback without threading React context.
  - [toast-region.tsx](../packages/web/src/app/ui/toast-region.tsx) +
    [.module.css](../packages/web/src/app/ui/toast-region.module.css) — fixed
    bottom-right viewport, neutral elevated card (`--panel-2` + `--shadow-2`), a
    new **`check`** glyph in [icon.tsx](../packages/web/src/app/ui/icon.tsx) carries
    the "success" meaning (no new colour token — teal stays reserved for
    "detected"). Entrance/exit via Base UI `data-starting/ending-style` (C.5
    convention; the global `prefers-reduced-motion` reset neutralises it).
    Viewport `aria-label` + close `aria-label` localised.
  - Errors keep using `AlertBanner` (persistent, must-see); toasts are the quiet
    "it worked" channel.
- **Export + save now confirm.** `useSeparation.exportStems`/`downloadStem` return a
  **success boolean** ([use-separation.ts](../packages/web/src/app/separation/use-separation.ts));
  a new [use-stem-export.ts](../packages/web/src/app/workstation-shell/use-stem-export.ts)
  hook (extracted from the shell) owns both export entry points and toasts
  « Stems exportés » / « Fichier exporté » on success.
  [use-project-session.ts](../packages/web/src/app/workstation-shell/use-project-session.ts)
  gained an `onSaved` dep → the shell toasts « *« Nom » enregistré* » once a save
  actually persists.
- **Shell tidy (fell out of the above).** Extracting the two export handlers into
  `useStemExport` also cleared a `react-doctor` "large component" warning my
  additions had tripped on `WorkstationShell` (was 305 lines).

## Not done / remaining

- **Browser-verify** — not run: no Chrome on this WSL2 box (see the standing
  memory note). Must be done **on the Mac** before merge: (1) paste a Spotify URL →
  inline warning + disabled submit; (2) export stems (zip) and a single lane WAV →
  toasts; (3) save a project → toast; (4) `prefers-reduced-motion` on → toast
  appears without motion.
- Roadmap tail after D.3: **D.2** (« Séparer » ↔ server health) and Lot E. **D.1
  (undo/redo) was deprioritised this session** (low value for the effort) — see the
  roadmap D.1 note.

## Decisions

- **Success feedback = a real transient toast**, not a reused `AlertBanner` or a
  chip flash (user choice). One primitive serves both export and save.
- **Unsupported URL = block submit + inline hint**, not warn-only (user choice) —
  consistent with the use-case rejecting it anyway.
- **Base UI Toast over a hand-rolled primitive** — already a dependency, gives
  a11y (`role`), auto-dismiss, focus-safe inertness, and C.5-style transitions for
  free. Per-instance manager (not the global singleton pattern) to keep tests
  isolated.
- **Toast is a `role="dialog"`** (Base UI's model): one pre-existing shell test that
  used a bare `queryByRole('dialog')` was scoped to the projects dialog by name.
- **URL specs paste rather than type** the link — atomic value set: no intermediate
  host flickers the warning, no slow-typing 5 s timeout under parallel load.

## Gate status

- typecheck: **pass**
- tests (with coverage): **pass — 582 tests**, coverage **95.75 % stmts / 95.62 %
  lines** (up from 94.8 %).
- mutation (Stryker, local): **skipped** — the only core change is a public
  re-export of an already-mutation-covered function; no new mutated logic.
- biome / sheriff / knip / jscpd: **pass** — arch clean, knip clean, **jscpd 5
  clones** (unchanged), react-doctor **no issues**.

## State to resume from

- **Single next action**: **browser-verify on the Mac** (the 4 checks above), then
  merge PR. After that, the next roadmap slice is **D.2** (« Séparer » ↔ server
  health).
- Gotchas / half-done edits: none. Branch `feat/web-feedbacks`, gate green. The
  `roadmap-excellence.md` change in this branch also carries the **D.1
  deprioritisation** decided earlier the same day.
