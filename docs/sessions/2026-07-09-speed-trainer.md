# Session — 2026-07-09 — speed-trainer (roadmap-excellence-2 Lot I.1)

## Done
- **Merged PR #73** (Lot H a11y live-regions) into `main`, branch
  `feat/speed-trainer` off the merge.
- **Fixed the pre-existing shell-spec flake first** (it failed nearly every
  run under today's machine load, and reproduced on pristine `main`): the
  reopen tests clicked « Ouvrir » straight after opening the projects dialog,
  and Base UI's initial focus — deferred to an animation frame — could land
  MID-TEST, stealing focus from the armed « Confirmer ? » row and disarming
  it. The projects-dialog spec had settled focus since the per-project-loops
  session; the shell spec never got the fix. New `openProjectsDialog` helper
  (open, then wait for focus INSIDE the dialog — queried **by name**, because
  a Base UI success toast also carries `role="dialog"`), used by all 12 open
  sites. Three consecutive fully-green runs after; committed separately.
- **Tempo floor lowered 50 % → 25 %** (`MIN_PLAYBACK_RATE` 0.25): fine
  transcription sits under half speed and the ramp wants room to start low.
  The transport slider derives its bounds from the core constants instead of
  hardcoding 50/150. SoundTouch keeps stretching below 0.5 — **audible
  quality at 25 % still to be judged by ear** (below).
- **Lot I.1 — the speed trainer**, a full slice:
  - Pure domain [speed-trainer.ts](../../packages/core/src/domain/speed-trainer.ts)
    (TDD, fast-check pin `min(target, start + ⌊k/N⌋·inc)`): percent-grained
    `SpeedTrainerPolicy` (départ / incrément / répétitions par palier /
    plafond) normalised on arm — clamped **natively in percent space**
    (`MIN/MAX_TEMPO_PERCENT`, new in playback-rate.ts; a `/100·*100`
    round-trip is not an IEEE754 identity and leaked `55.00000000000001 %`
    into the read-out), `NaN` → full speed, target lifted to the start,
    increment/cadence floored. `recordLoopPass` steps every N passes, caps at
    the target, and is the identity once there. `completesLoopPass(region,
    seconds)` (review-driven, below) tells a played-through pass from a
    corrective wrap.
  - Web wiring: `useTransportEngines` gains `onLoopWrap` (fired on the
    existing wrap branch, **gated on `completesLoopPass`**);
    [use-speed-trainer.ts](../../packages/web/src/app/loops/use-speed-trainer.ts)
    owns the ramp (ref-backed event-handler applies — react-doctor rejects
    effect-applied event logic — and stable identities so the per-frame host
    render doesn't defeat memoisation); `usePlayer` composes it and stops it
    at every seam that kills its premise.
  - UI in the loop controls:
    [speed-trainer-controls.tsx](../../packages/web/src/app/loops/speed-trainer-controls.tsx)
    — « Rampe de tempo » popover (4 number fields, defaults 70 % / +5 % /
    1 tour / 100 %, Enter submits, `memo`ised) and, while running, the ramp
    read-out + « Arrêter la rampe », each earned step announced through the
    Lot-H `LiveStatus` channel. 9 new Lingui ids (`loops.trainer-*`),
    extracted. Hidden in play-through mode (a ramp needs wraps).
- **High-effort review (8 parallel angles) on the first cut** — fixed
  test-first (7 RED → GREEN):
  1. A seek/scrub past the loop end counted a practice pass (default +5 % per
     pass ramped on clicks) → `completesLoopPass` gate (0.5 s overshoot
     margin, frame-sized + stall-tolerant).
  2. `Number('')` is 0, not NaN: an emptied field bypassed the domain's
     full-speed fallback and clamped to the 25 % floor; an emptied plafond
     even pinned the ramp at its start forever → blank fields now reach the
     domain as NaN.
  3. The ramp survived everything that killed its premise → it stops on:
     slider takeover (public `setTimeRatio` = user authority; the trainer
     applies via the internal path), loop toggled off (+ the entry point
     steps aside), passage replaced (fresh drag or recalled saved loop, via
     `useLoopEditing`'s new `onRegionReplaced` seam — **handle adjustments
     keep it running**), `restoreLoop` (hardening), clearing (already).
  4. Float-junk percent clamp (above).
  5. Perf/reuse: stable hook identities + `memo(SpeedTrainerControls)` (the
     popover subtree no longer re-renders per animation frame), `.field` /
     `.label` hoisted into the shared popover-form skin (name-editor composes
     them too), one percent-bounds definition for slider + form + domain.

## Not done / remaining
- **Browser pass on the Mac, three ears/eyes items** (skipped here per the
  browser-verify-only-hard-cases rule — jsdom already drives the whole flow):
  1. **Listen at 25 %** — SoundTouch artefact level is the roadmap's explicit
     « vérifier la qualité » question; if it's unusable, raise the floor.
  2. Look at the ramp popover + running read-out in the tight loop-controls
     row (reuses the rename-popover skins, so risk is low).
  3. Optionally VoiceOver the ramp announcements (« Rampe 70 % → 100 % » per
     step — spoken via the same LiveStatus pattern Lot H shipped).
- Deferred, noted from review, no action: extracting a shared `PopoverForm`
  (the trainer form is the 3rd hand-copy of the NameEditor/URL-form skeleton;
  Enter-submit parity was patched locally), deriving
  `passesInStep`/`currentPercent` from a single pass counter (state can't
  drift, but the current shape is tested and 100 % mutation-killed),
  per-pass `setState` re-rendering the shell for an invisible counter change.
- The trainer is **session-only state** (not persisted, not signed) — a
  deliberate scope line; persisting a ramp with the project is future work if
  practice sessions ask for it.
- `playback-rate.ts` mutation survivors: 2 **equivalent** boundary mutants
  (`<` → `<=` at the exact clamp bound returns the same value) — not
  actionable.

## Decisions
- **Percent is the ramp's grain** (`SpeedTrainerPolicy` in integer percent,
  not ratio): it is the transport control's grain, the arithmetic stays exact
  (0.7 + 0.05 ≠ 0.75 in floats), and the clamp lives natively in percent
  space. `MIN/MAX_TEMPO_PERCENT` are the one derivation of the playable range
  in that grain.
- **The ramp stops when its premise dies** — one rule, five seams: loupe
  cleared or replaced (a ramp belongs to the passage it was armed on; handle
  adjustments are the same passage and keep it), looping off, user slider
  takeover, project open. The earned tempo always stays (stopping never
  snaps the speed back).
- **A pass is played-through, not merely wrapped**: the transport wraps every
  overshoot; the trainer counts only frame-sized ones (`completesLoopPass`,
  0.5 s margin).
- **Ramp state applies in the event handler, not an effect** (react-doctor
  `no-event-handler` is blocking): the tempo lands the instant the pass
  wraps; the ref/state duo is the accepted cost, documented in the hook.
- The trainer UI announces **arm + each earned step** through `LiveStatus`
  (Lot H channel): steps are discrete outcomes, not continuous values.

## Gate status
- typecheck: ✅
- tests (with coverage): ✅ **710 passed** (74 files; +32 this session) —
  coverage 96,04 % stmts / 88,94 % branches (thresholds 85/80)
- mutation (Stryker, local — core touched): ✅ **95,22 %** overall;
  `speed-trainer.ts` **100 %** (39 mutants); `playback-rate.ts` 87,5 % (2
  equivalent boundary survivors, hand-verified)
- biome / sheriff / knip / jscpd: ✅ / ✅ / ✅ / ✅ 5 clones (unchanged);
  react-doctor ✅ 0 (after moving the ramp apply back into the handlers)

## State to resume from
- **Single next action**: push + **open the PR** for `feat/speed-trainer`
  (4 commits: shell-spec flake fix, tempo floor, feature, review fixes; this
  report on top). After merge: **Lot I.2** (tempo manuel — tap-tempo, saisie
  BPM, calage de phase; the override becomes signed in `sessionSignature`,
  unlike the derived detection) then **I.3** (count-in du métronome).
- Gotchas: `useSpeedTrainer`'s `stateRef` is the source of truth and
  `useState` mirrors it — every transition must write BOTH (the hook doc
  says so). `SpeedTrainerControls` is `memo`ised: it only re-renders when the
  trainer identity changes, so any new prop must be stable or it will look
  frozen. The shell spec's `openProjectsDialog` helper must be used for ANY
  new test clicking inside the projects dialog, or the focus-steal flake
  returns. The 25 % floor ships **unverified by ear** — listen before
  building I.2 on top of it.
