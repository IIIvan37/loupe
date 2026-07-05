# Session — 2026-07-05 — web-dnd-empty-state (Lot C.1)

Branch `feat/web-dnd-empty-state` (off `main`). First visible win of Lot C
(« fossé produit »): native OS-file drag-and-drop + a real first-run empty-state.

## Done
- **Library evaluation → native.** Weighed the "DnD" widget libraries
  (`@dnd-kit`, `react-dnd`, `pragmatic-drag-and-drop`) against the actual need.
  C.1 is an **OS→browser file drop** (`dragover`/`drop`/`dataTransfer.files`),
  not intra-app widget dragging — those libs don't expose `dataTransfer.files`
  and some suppress native DnD, so they're the wrong family. `react-dropzone`
  (~11 KB) would wrap ~40 lines we'd write anyway. **Chose the native API**: zero
  deps, a pure guard + a humble hook, aligned with the pure-core / humble-object
  discipline.
- **Pure guard** `web/src/lib/pick-audio-file.ts` (TDD): first `audio/*` file in a
  drop, with an extension-allowlist fallback for empty MIME types (`.flac`/`.aiff`
  on some OSes). Mirrors the picker's `accept="audio/*"`.
- **Humble hook** `use-file-drop.ts`: `isDraggingFile` via a dragenter/dragleave
  depth counter (crossing into a child never flickers the overlay), `drop` →
  `pickAudioFile` → callback. Ignores non-file drags and non-audio drops.
- **Drop→import decision** `use-drop-import.ts`: import immediately, or hold the
  file for confirmation when the session holds unsaved work (a one-shot drop can't
  ride the header's two-step « Confirmer ? »).
- **`ConfirmImportDialog`**: « Remplacer la session ? » with the dropped file
  name; any dismissal cancels, only « Importer » replaces.
- **`EmptyState`** hero (shown when `importState.status === 'idle'`): dashed
  drop-zone « Glissez un fichier audio ici », format hint, an « Importer un
  fichier » CTA, and the live keyboard layout (`describeKeyBindings`). It IS the
  `<main>` landmark while idle. Replaces the old greyed-out workstation.
- **Shell wiring**: hidden file input lifted from `ShellHeader` to the shell
  (shared by the header button + the hero via `openFilePicker`); full-viewport
  drop overlay; `session.importPickedFile(file)` extracted so a dropped `File`
  rides the exact picker path.
- **Maintainability refactor** (to keep `check:react` green after the wiring
  grew the shell): extracted `ShellDropLayer` (overlay + input + confirm dialog)
  and `useSeparateAndLoad` (the separate→wire-mixer handler) out of
  `WorkstationShell`.
- **Browser-verified** (real Chrome, dev server): empty-state hero renders; drop
  overlay appears on a file dragover; dropping a valid WAV imports end-to-end
  (header title = file name, waveform + tabs appear); dropping over an unsaved
  session shows the « Remplacer la session ? » confirmation.

## Not done / remaining
- Lot C.2 (responsive/tactile) and C.3 (design-system tokens) — next C slices.
- Optional "morceau d'exemple" in the empty-state was **declined** (kept hero +
  shortcuts only).

## Decisions
- **Native file-drop, no DnD library** — the widget DnD libs don't solve OS file
  drop; `react-dropzone` isn't worth a dep for our single-audio-file case.
- **Empty-state only in the `idle` state** — `loading`/`error`/`loaded` keep the
  workstation (so decode errors still surface in `WaveformView`).
- **Drop-confirm = dialog, not two-step** — a drop is one-shot; the header's
  arm-then-confirm can't ride it.

## Gate status
- typecheck: **pass**.
- tests (with coverage): **573 passed**, coverage web 94.88 % stmts / 87.29 %
  branch (floor 85/80), core 100 %. `pnpm gate` **exit 0**.
- mutation (Stryker): **skipped** — no `@app/core` change (the guard lives in
  `web/src/lib`).
- biome / sheriff / knip / jscpd / react-doctor: **all green** (jscpd 7 clones
  0.75 %, no new; react-doctor 0 issues after the extractions).
- ⚠️ **Pre-existing flake** (NOT introduced here): the project-**reopen** tests in
  `workstation-shell.spec.tsx` (confirm-open two-step) are order/timing-dependent
  under load — verified identical on `main` with all changes stashed (base flaked
  2–4). They pass in isolation and passed in the green gate run above. Separate
  test-infra debt, out of scope for this slice.

## State to resume from
- **Single next action**: commit the feature on `feat/web-dnd-empty-state`, then
  this report + STATUS, then `pnpm gate` → push → open PR (rebase onto
  `origin/main`, which is ahead of local `main` by the merged server PRs).
- Gotchas: nothing half-done. The reopen-test flake may surface on a loaded
  machine — re-run the gate; it is not a regression from this branch.
