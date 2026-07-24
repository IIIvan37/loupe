# Session — 2026-07-05 — web-responsive-tactile

Lot **C.2** — responsive & tactile pass. Branch `feat/web-responsive-tactile`,
stacked on C.1 (`feat/web-dnd-empty-state`, PR #57, still open). CSS-only slice:
no core, no TS logic (one small JSX wrapper `div` added). **PR #58.**

## Done

Starting point (mapped first): the whole app had **one** layout media query
(`900px`, collapsing the 360px side-panel), every touch target was 18–36px, and
the only fixed widths were `--track-gutter-width: 200px` (tokenised) and an
inline `360px` panel (not).

The work is done the **Every Layout way — intrinsic responsiveness, not viewport
breakpoints** (the app is built on Every Layout; media queries are against its
grain). End state: **zero viewport media queries**; the only `@media` left is the
`(pointer: coarse)` feature query.

- **Header + transport bar reflow via `Cluster` (`flex-wrap`)** — each is two
  `Cluster` groups; adding `flex-wrap: wrap` + a row-gap lets the second group
  stack when it can't share the row. No query.
- **Body two-column ⇄ stacked is an Every Layout Sidebar**
  ([workstation-shell.module.css](../../packages/web/src/app/workstation-shell/workstation-shell.module.css)):
  `.body` is `display: flex; flex-wrap: wrap`; `.main` is
  `flex-grow: 999; flex-basis: 0; min-inline-size: 60%`; the panel wrapper
  `.panelSlot` is `flex-grow: 1; flex-basis: var(--panel-width)`. The panel keeps
  its width beside the main and **wraps below intrinsically** once the main can't
  hold 60 %. Geometry (`0.6·W + panel = W ⇒ W ≈ panel/0.4`) reproduces the old
  900px collapse at ~888px — verified live. `.panelSlot` is a single-cell grid so
  the panel still stretches to full height (its `border-inline-start` divider
  reaches top to bottom). `AnalysisPanel` got wrapped in that slot
  ([shell-main.tsx](../../packages/web/src/app/workstation-shell/shell-main.tsx)).
- **Fluid dimensions via `clamp()`** instead of a breakpoint: gutter
  `--track-gutter-width: clamp(132px, 40vw, 200px)`, page padding
  `clamp(var(--space-s), 2.5vw, var(--space-l))`. `impeccable` (magic-number rule)
  stays green.
- **Tokenised**: inline `360px` → `--panel-width` (the Sidebar basis); new
  `--touch-target: 44px`.
- **Touch targets ≥44px, only under `@media (pointer: coarse)`** — an
  input-modality signal, **not** a viewport breakpoint (no intrinsic-layout
  equivalent exists). Desktop DAW density untouched. Two composable helpers in
  [controls.module.css](../../packages/web/src/app/ui/controls.module.css):
  `touchTarget` (centered transparent `::after`, 44×44 — for controls with room)
  and `touchTargetTall` (44px tall, `width:100%` — for tight rows where a
  full-width overlay would overlap the neighbour). Composed by transport
  `.control`, header `.iconAction`/`.secondaryAction`/`.primaryAction`/
  `.confirmAction`, analysis-panel `.tab` (`touchTarget`); mixer mute/solo
  `.toggle` + `.download`, zoom `.tick` (`touchTargetTall`). Kept DRY — the
  expander lives once and is `composes:`d; **jscpd stayed at 7 clones**.

## Not done / remaining

- **Mute/solo touch target not browser-verified live** — it needs a real
  separation (server + Demucs) to render the stem gutter, out of scope for a CSS
  pass. Verified by construction: `touchTargetTall` shares the exact same
  `@media (pointer: coarse)` block as `touchTarget`, whose 44px overlay **was**
  measured live on the always-present transport/header controls (44×44 confirmed).
- Marker-rail tags + waveform edit handles left at their small sizes — they're
  **drag** affordances; expanding their hit area risks overlapping siblings.
  Noted as follow-up if touch use surfaces it.
- C.3 (design system: typo/elevation/z-index) is the natural next slice and will
  share these tokens.

## Decisions

- **Intrinsic over breakpoints (Every Layout).** No viewport media queries: reflow
  via `Cluster`/`flex-wrap`, the two-column flip via a **Sidebar** (flex-basis +
  `min-inline-size` threshold), fluid dimensions via `clamp()`. This corrected a
  first cut that had added a `640px` compact media query + leaned on the `900px`
  panel query — against the Every Layout grain.
- **`(pointer: coarse)` is the one legitimate query** — it detects input
  modality, not viewport size, and has no intrinsic-layout equivalent. Touch =
  expand the hit area (transparent `::after`), keep the visuals; tall-only variant
  in the tight gutter so adjacent toggles don't overlap.
- **Stacked on C.1** rather than branching off main — same shell CSS, and it lets
  the responsive pass also cover C.1's empty-state. C.2's PR (#58) merges after
  C.1's (#57).

## Gate status

- typecheck: **green** (`tsc --noEmit` root + web).
- tests (with coverage): **green — 573 tests**, web 94.88 % stmts / 87.29 %
  branches (unchanged — CSS + a wrapper `div`).
- mutation (Stryker, local): **skipped** — no `@app/core` (mutated scope) touched.
- biome / sheriff / knip / jscpd: **all green**; `impeccable` (check:design) +
  react-doctor green; jscpd **7 clones** (no regression).
- **Browser-verified** (chrome-devtools, real decoded WAV track) across **360 /
  700 / 880 / 1000 / 1440px**: page horizontal overflow **0** at every width. The
  Sidebar sits side-by-side at 1000/1440 (main+panel), **flips to stacked at
  ~888px**, stays stacked at 700/360; gutter `clamp` resolves 200px → 144px at
  360; padding `clamp` → 12px at 360. Touch (coarse pointer): transport `.control`
  (visual 36px) and header `.iconAction` (28px) both expose a **44×44** hit area.

## State to resume from

- **Single next action**: **PR #58 opened** (base `feat/web-dnd-empty-state`,
  stacked on C.1 #57). Merge C.1 #57 first; #58 then rebases cleanly onto main.
  After merge, C.3 (design system) is the next slice.
- Gotchas / half-done edits: the `CLAUDE.md` change in this branch (the "Confirm
  the approach before coding a UI slice" line) is C.1's guidance carried over,
  shipped as its own `docs:` commit. The separation server was **offline** during
  browser-verify (hence "Failed to fetch" on TEMPO and no stem gutter) — expected,
  not a layout defect. The branch history was cleaned (soft-reset) to drop a
  superseded first cut that used viewport media queries.
