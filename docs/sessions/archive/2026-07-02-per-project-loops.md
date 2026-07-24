# Session — 2026-07-02 — per-project-loops

## Done
- **Per-project loops shipped** (166e94c) — the slice decided last session: the
  localStorage `LoopStore` is gone. Loops are session state (`useLoops` is
  plain `useState` over the pure `LoopLibrary` domain), cleared by
  `startFreshTrack` on every new import, persisted **only** through the project
  manifest (which already stored and restored them). Core lost the `LoopStore`
  port and the `loadLoops`/`saveLoop`/`deleteLoop` use-cases (registry README
  updated); web lost the localStorage adapter and the shell's `loopStore`
  injection. TDD: shell acceptance test « a new import clears the saved loops ».
- **Root-caused and fixed the flaky projects-dialog spec** (625cf51) — the
  two-step delete test failed deterministically in isolation, intermittently in
  the suite (pre-existing on `main`, from the user-event migration). Cause:
  Base UI defers the dialog's initial focus to an animation frame; in jsdom
  that rAF fires mid-test, steals focus from the armed « Confirmer ? » button,
  and its `onBlur` disarms it under the second click. Fix: specs settle the
  initial focus before clicking (`renderDialogSettled`), and each row action is
  now ONE relabeled button element (`RowAction`) so arming never unmounts the
  focused element.
- **Branch code review (8 finder angles → 6 verifier verdicts) and fixes**
  (e0ad901). Two confirmed session-lifecycle bugs fixed TDD-first:
  - `restoreSession` restored the old project's loops/markers even when its
    re-import resolved **superseded** (fresh file picked mid-open) — the
    `!audio` guard now precedes the restores, closing the last gap in the
    stale-async-resolution invariant from the previous session.
  - Removing the **active** saved loop left the region flagged `isSaved`
    (save/clear controls hidden, orphan region) — pre-existing on `main`;
    `loopEditing.remove` now owns removal and marks the region unsaved.
  - Cleanups: `saveNamedLoop` spec helper (drag-name-save ritual was ×3),
    `useLoops` `save`/`clear` delegate to `update`/`restore`, `RowAction`
    disarms before confirming + hoisted armed predicate, settle helper made
    portable (asserts focus INSIDE the popup — `not body` passes early on
    click-opened dialogs), Base UI settle gotcha documented in the
    `react-testing-patterns` skill (stale `LoopStore` mention dropped).
- Review candidates **refuted** (recorded so they aren't re-litigated):
  orphaned `loupe.loops` localStorage key and loops-lost-on-reload are the
  documented intent of the per-project decision (pre-release, single user);
  `crypto.randomUUID` secure-context is a pre-existing codebase-wide pattern;
  the same dialog race in `workstation-shell.spec` is mechanically unreachable
  today (the rAF target happens to be the already-focused button).

## Not done / remaining
- **PR to open** for this branch (3 commits + this report).
- Backlog (from review, deliberately not this branch): a uniform
  dirty-session guard (beforeunload or confirm-on-import) covering loops AND
  markers/stems — import currently wipes silently while project-open confirms;
  shared in-memory `ProjectDeps` fake (still duplicated between
  `use-projects.spec.tsx` and `workstation-shell.spec.tsx`);
  `userEvent.setup()` hoisted into per-file render helpers; save-after-failed-
  import behavior (detach means a save now mints a duplicate — decide + test);
  stale project error banner surviving a new import (`detach()` could clear it).
- Then: **J2.6 export** (aligned stem folder) and the UX backlog (tempo
  detection, tempo/pitch/zoom persistence, speed trainer, undo).

## Decisions
- **Loops are per-project — implemented.** Session-state only; the manifest is
  the sole persistence. Any future "restore loops outside a project" need goes
  through a project, not a side store.
- **Session-lifecycle invariant sharpened**: a stale async resolution must not
  restore ANY session surface — `restoreSession` now aborts wholesale when its
  re-import was superseded (generation guard in `useProjects`, epoch in the
  shell, supersede guard in `importFile`, and now the restore-abort).
- **Testing idiom addition** (in the skill): settle a Base UI dialog's
  deferred initial focus before clicking inside it, by asserting focus landed
  inside the popup (`renderDialogSettled` pattern).

## Gate status
- typecheck: ✅
- tests (with coverage): ✅ 347 tests, 44 files (dialog spec also verified
  stable ×10 in isolation — it was deterministically red there before)
- mutation (Stryker, local, if core touched): ✅ **95.44 %** (≥ 80 threshold) —
  core was touched (port + use-case deletions); run on the loops-slice commit,
  core untouched since
- biome / sheriff / knip / jscpd / impeccable / react-doctor: ✅ (`pnpm gate`
  exit 0)

## State to resume from
- **Single next action**: push `feat/per-project-loops` and open its PR
  (166e94c loops slice, 625cf51 dialog-flake fix, e0ad901 review fixes, + this
  report). After merge: pick **J2.6 export** or a backlog item above on a
  fresh branch off `main`.
- Gotchas / half-done edits: none — tree clean, gate green. The `loupe.loops`
  localStorage key is intentionally orphaned (decision above); delete it by
  hand if it ever bothers.
