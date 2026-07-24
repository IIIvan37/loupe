# Session — 2026-07-05 — web-overlay-micromotion

Lot **C.5** of the excellence roadmap — micro-motion for the overlays. CSS-only,
no core, no new component. Off fresh `main` (C.4 merged as PR #60).

## Done
- **Motion tokens** ([tokens.css](../../packages/web/src/styles/tokens.css)):
  `--motion-fast: 130ms` (light popovers), `--motion-med: 180ms` (modal dialog +
  banner), `--motion-ease: cubic-bezier(0.16, 1, 0.3, 1)` (ease-out — appears
  briskly, settles). One source of truth; no per-rule reduced-motion guard needed
  (the global reset in [global.css](../../packages/web/src/styles/global.css:113)
  already collapses every transition/animation duration).
- **Dialog** ([app-dialog.module.css](../../packages/web/src/app/ui/app-dialog.module.css)):
  backdrop **fades** (`--motion-med`); popup **fades + scales** `0.96 → 1` via the
  Base UI `data-starting-style` / `data-ending-style` attrs, **keeping the centring
  `translate(-50%, -50%)` in every state** (the scale composes onto it). Shared by
  every `AppDialog` (projects, shortcuts) and the `ConfirmImportDialog` (it reuses
  these same classes).
- **Popovers / menu**: a shared `.motion` class in
  [popover-form.module.css](../../packages/web/src/app/ui/popover-form.module.css)
  (fade + lift `translateY(-4px)` on the Base UI enter/exit attrs, `--motion-fast`)
  — `composes:`d by the popover-form `.popup` (rename / URL forms) and by the
  import-menu `.menu` ([import-menu.module.css](../../packages/web/src/app/header/import-menu.module.css)),
  so the transition is defined **once**.
- **Alert banner** ([alert-banner.module.css](../../packages/web/src/app/ui/alert-banner.module.css)):
  it's a plain mounted `<div>` (not a Base UI overlay), so it only animates **in** —
  a short `@keyframes alert-in` slide-down + fade (`--motion-med`).
- **Browser-verified** offline (server offline is fine — no separation needed):
  - shortcuts dialog: popup transition computed `opacity, transform / 0.18s`,
    backdrop `0.18s`; opens with `data-open`.
  - **exit is animated and clean**: on close the dialog **stays mounted through the
    exit transition** then fully unmounts after 400 ms (no stuck-overlay bug) —
    Base UI is running the exit, `getAnimations`-gated so jsdom still closes
    synchronously in tests.
  - import-menu popup: transition computed `opacity, transform / 0.13s` (fast token).

## Not done / remaining
- The full-viewport **drop overlay** (`ShellDropLayer`) is intentionally left
  un-animated — it tracks live drag events, where an enter/exit transition would
  lag the pointer. Out of C.5 scope (roadmap named dialogs/popovers/banner).
- Alert-banner **exit** is not animated (React unmounts it immediately; it's not a
  Base UI overlay). Entrance-only is the discreet, low-risk choice.
- `prefers-reduced-motion` path not re-emulated in-browser this session; it relies
  on the pre-existing, unchanged global reset (gate-covered, app-wide).

## Decisions
- **Reduced-motion is handled globally, not per-overlay.** The
  `@media (prefers-reduced-motion: reduce)` reset in `global.css` already forces
  `transition-duration`/`animation-duration` to `0.01ms !important` on everything,
  so new overlay transitions need no local guard — keeps the motion tokens clean.
- **Motion lives in tokens + shared skins, never per-component.** Dialog motion in
  `app-dialog`, popover motion in a `.motion` class `composes:`d by all popover
  surfaces — so jscpd stays flat and there's one place to tune the feel.
- **Preserve the dialog's centring transform.** The popup centres with
  `translate(-50%, -50%)`; the enter/exit state re-declares the full transform
  (`translate(-50%, -50%) scale(0.96)`) rather than a bare `scale()` that would
  drop the centring.

## Gate status
- typecheck: **green**.
- tests (with coverage): **green — 573 passed** (65 files); web coverage
  **94.89 % / 87.29 %** (unchanged — CSS-only).
- mutation (Stryker, local): **skipped** — no `@app/core` change this step.
- biome / sheriff / knip / jscpd: **green**; `check:arch` + `check:design` clean;
  **jscpd 5 clones** (unchanged from C.4 — the `.motion`/token reuse added no
  duplication).

## State to resume from
- **Single next action**: push `feat/web-overlay-micromotion` and open its PR
  (base `main`); then pick **Lot C.6 / Lot D** from
  [roadmap-excellence.md](../roadmap-excellence.md) — Lot C is essentially done
  (C.1–C.5 shipped); next candidates are **D.1 undo/redo** (high leverage, pure
  reducers already exist), **D.2 wire « Séparer » to server health**, or **D.3
  missing feedbacks** (export toast, inline URL-host hint).
- Gotchas / half-done edits: none — working tree is the five CSS files above,
  gate green, browser-verified.
