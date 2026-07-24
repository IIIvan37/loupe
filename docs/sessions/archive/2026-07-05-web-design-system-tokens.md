# Session — 2026-07-05 — web-design-system-tokens

Lot **C.3 — Compléter le design system** (roadmap-excellence). CSS-only, no core.
Branch `feat/web-design-system-tokens` off `main` (C.1 #57 + C.2 #58 merged).

## Done
- **Type scale** — added an 8-step modular scale to
  [tokens.css](../../packages/web/src/styles/tokens.css)
  (`--font-size-2xs … --font-size-2xl`) and replaced **all 62** hard-coded rem
  `font-size` declarations across 22 CSS modules. The 17 distinct literals
  clustered into 8 steps (near-duplicates like 0.6/0.62/0.625/0.65 collapse to
  one step) — a handful of sizes shift ≤1px, the deliberate cost of a real scale
  (user chose consolidation over a faithful token-per-value aliasing). `s`
  (0.8rem) is the dominant step; the scale is weighted toward the small end where
  the dense workstation lives. Grep confirms **zero** rem literal `font-size:`
  left outside the token file.
- **Elevation** — added `--shadow-1` (light overlays: menus, popovers) and
  `--shadow-2` (modal dialog), tuned deep/low-spread for the dark UI. Applied:
  `--shadow-2` on the app-dialog popup, `--shadow-1` on the popover-form popup and
  the import menu. Dialogs/popovers had **no** elevation before (only 1px hairline
  borders) — they now visibly float off the backdrop.
- **Z-index scale** — added `--z-playhead:10 / --z-overlay:20 / --z-dialog:30 /
  --z-popover:40` (gaps of 10). Replaced the two raw values (playhead `4`,
  drop-overlay `5`) and made the previously-implicit dialog/popover/menu stacking
  **explicit**. **Popover sits ABOVE dialog on purpose**: the « Renommer »
  popover opens from *inside* the projects dialog and must float over it.
  - **Regression + real root cause (user-reported twice).** Making the dialog
    z-index explicit surfaced a latent stacking bug. Base UI's structure is
    `Portal > Positioner > Popup`: the **Positioner** carries the positioning
    (`position: absolute`) and thus owns the stacking context; the **Popup** is
    `position: static`, so a `z-index` on it is **inert**. My first cut put
    `z-index` on the Popup (`.popup`/`.menu`) — ignored — while the dialog popup
    *is* positioned, so its `z-index:30` applied and won. Fix: a shared
    `.positioner` class (`z-index: var(--z-popover)`) applied to all three
    `Popover.Positioner`s (name-editor rename, import menu, URL popover);
    box-shadow stays on the Popup. **Browser-verified offline** on the import
    menu: Positioner computes `position:absolute; z-index:40` over the dialog's
    `z-index:30`. The projects-rename popover is the identical name-editor
    Positioner + same token, so it now floats above the projects dialog.
- **Radius scale** — added `--radius-xs:2px / -s:4px / --radius:6px (unchanged) /
  -l:9px / --radius-pill:999px`. Replaced all 9 non-token radius values; the only
  literals left are three `50%` (legitimate round ratio, not a magic number).
- **Browser-verified** the net-new elevation: opened the shortcuts dialog,
  computed style resolves `box-shadow: rgba(0,0,0,0.5) 0 12px 32px`, `z-index:40`,
  title `19.2px` (`--font-size-l`); screenshot shows the popup floating with a
  soft shadow over the dimmed backdrop.

## Not done / remaining
- C.4 (unify buttons — header's 2nd button system composes `controls.module.css`
  + inline SVG icon set) and C.5 (overlay micro-motion) — the rest of Lot C.
- The two `box-shadow: 0 0 0 1px var(--line)` in `global.css` left as-is — they
  are hairline border emulation, not elevation, so out of the `--shadow-*` scope.

## Decisions
- **8-step modular type scale over faithful aliasing** (user-chosen). A scale is
  the point of C.3; a token-per-value map wouldn't consolidate. Accepts ≤1px
  shifts on a few sizes. See [[every-layout-no-media-queries]] neighbour work —
  this is the type/elevation/z sibling to the C.2 responsive pass.
- Dialog/popover z-index made **explicit** rather than left to portal DOM order,
  since the tokens now exist and intent should be visible.

## Gate status
- typecheck: ✅
- tests (with coverage): ✅ **573 passed** (65 files); coverage **94.88 % / 87.29 %**
  (unchanged — CSS-only)
- mutation (Stryker, local): **skipped** — no `@app/core` change (CSS-only)
- biome / sheriff / knip / jscpd: ✅ (`pnpm gate` exit 0); **check:design**
  (impeccable) ✅ green

## State to resume from
- **Single next action**: commit the report on this branch → `pnpm gate` → push →
  open PR (target `main`); then pick **C.4** (button unification + SVG icons) as
  the next Lot C slice.
- Gotchas / half-done edits: none — working tree is the full slice, gate green.
- **Re-test with the server up**: open a saved project → « Renommer » and confirm
  the popover floats above the projects dialog (verified offline on the identical
  import-menu Positioner; the server-backed projects flow wasn't re-driven).
- **Durable gotcha**: in Base UI `Portal > Positioner > Popup`, z-index belongs on
  the **Positioner** (positioned), never the Popup (static → inert).
