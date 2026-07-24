# Session — 2026-07-08 — web-a11y-live-regions (roadmap-excellence-2, Lot H)

## Done
- **Lot H.1 — the app's long operations are now audible to screen readers**
  (web-only, no core), on branch `feat/web-a11y-live-regions` off `main`
  (Lot G merged as PR #72).
  - **New `app/ui` primitive [live-status.tsx](../../packages/web/src/app/ui/live-status.tsx)**:
    a persistent visually-hidden `role="status"` region whose text is written
    **from an effect** (mount empty, mutate after — the canonical announcer
    pattern). This encodes the two live-region invariants in one place: the
    region must exist *before* its content changes, and the change is what gets
    announced — even when the consumer mounts with a message already in hand.
    Direct `textContent` write (no state) — react-doctor's derived-state rules
    stay green; React renders no children there so there is no reconciliation
    conflict. Colocated spec (4 tests).
  - **SeparationPanel** narrates the run: step labels while in flight
    (« Analyse du mix… » / « Séparation des pistes… » — never the moving
    percentage, to avoid announcement spam), and a new **completion message**
    `separation.done` « Pistes séparées » spoken from a `LiveStatus` that
    **outlives the visible panel** (fragment root; the section still steps
    aside once the stems are ready). The step label is resolved once per
    render and feeds both the region and the visible progress head.
  - **TempoPanel** announces « Analyse… » then the **representative BPM**
    (`{0} BPM` via `msg()` descriptors so the announced copy carries its own
    source message). Detection **wins over a held BPM** (a retry can start
    while the previous analysis is still seated — `useTempo.detect` doesn't
    clear `analysis`). The playhead-following read-out is deliberately NOT the
    announced value (a varying track would be spoken at every segment change).
  - The shared **`srOnly` clip utility** landed in
    [controls.module.css](../../packages/web/src/app/ui/controls.module.css);
    the shell's `.fileInput` now `composes:` it (jscpd stays at 5 clones).
- **High-effort review (8 finder angles) found 3 real bugs in the first cut,
  fixed test-first** — all three the same root cause (a live region announces
  only what changes after it exists):
  1. `TempoPanel` mounts behind `isLoaded` at the very instant detection
     starts, so « Analyse… » (or the restored BPM on project reopen) was the
     region's *initial* content — never spoken. Fixed by `LiveStatus`'s
     effect-deferred write.
  2. The separation panel returned `null` on `ready`, unmounting the region at
     the exact moment the completion would fire. Fixed by the fragment root +
     `separation.done`.
  3. The region's ternary put `bpm` before `detecting`, so a retry with a held
     analysis kept announcing the stale BPM. Detection now wins.
- Review cleanups also applied: hardcoded `'128 BPM'`/`'120 BPM'` in the five
  shell-spec queries replaced by `i18n._('tempo.bpm', { 0: … })`; the
  separation spec names its `visibleOnly` ignore option like the shell spec;
  the tempo spec's `renderPanel` grew a `rerenderPanel` (no more hand-spelled
  9-prop blocks).

## Not done / remaining
- **Browser-verify skipped on purpose** (memory rule: reserve the browser for
  what tests can't reach). The only thing jsdom can't prove here is the actual
  screen-reader utterance — that needs a **manual VoiceOver pass** (import a
  track → hear « Analyse… » then « NNN BPM »; run a separation → hear the two
  steps then « Pistes séparées »), which no automated browser drive would show
  either. Layout risk is nil (1×1 clipped spans, the same pattern as the
  existing hidden file input).
- Deferred, noted from the review, no action: a shell-level global announcer
  (LiveStatus is the primitive; centralising is future work if more panels
  need it), per-frame `i18n._` memoisation in `TempoPanel` (micro — the panel
  already re-renders per animation frame), multiple simultaneous
  `role="status"` elements (correct ARIA; future shell specs should scope
  `getByRole('status')` with `within()`).
- Testing-Library's global `defaultIgnore` was considered for the mirrored-text
  collisions and **rejected**: the drop overlay is itself `role="status"` and
  three shell assertions query its text.

## Decisions
- **Announcements are a dedicated hidden channel, not the visible elements.**
  The visible candidates are disqualified structurally: separation's step label
  unmounts between runs, tempo's read-out follows the playhead. Mirroring into
  a persistent `LiveStatus` is the pattern; specs assert the visible channel
  with `visibleOnly` (ignore `[role="status"]`) and the announced channel via
  `getByRole('status')`.
- **Announce steps and outcomes, never continuous values** (percentage, felt
  BPM at the playhead) — polite regions re-read on every change.
- `separation.done` is **spoken-only copy** (the stems appearing are the
  visible cue) — first catalog entry with no visible rendering.

## Gate status
- typecheck: ✅
- tests (with coverage): ✅ **678 passed** (72 files; +12 this session) —
  coverage 95.73 % stmts / 88.75 % branches (thresholds 85/80)
- mutation (Stryker, local, if core touched): **skipped — no core change**
  (web-only slice)
- biome / sheriff / knip / jscpd: ✅ / ✅ / ✅ / ✅ 5 clones (unchanged);
  react-doctor ✅ 0 issues (after switching LiveStatus from effect-copied
  state to a direct textContent write)

## State to resume from
- **Single next action**: push + **open the PR** for
  `feat/web-a11y-live-regions` (two commits: `3df57d0` feature,
  `dda9eec` review fixes; report commit on top). After merge: **Lot I**
  (pratique du tempo — I.1 speed trainer, I.2 tap-tempo/saisie BPM/calage de
  phase, I.3 count-in), ~2–3 sessions, the biggest product gap.
- Gotchas: `LiveStatus` must stay mounted across the flow it narrates —
  unmounting silences the change (the component doc says so); if a future
  panel conditionally renders it, the first announcement silently disappears.
  When asserting visible text that a live region mirrors, use the spec-local
  `visibleOnly` option or the query throws « found multiple elements ».
