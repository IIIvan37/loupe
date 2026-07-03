# Session — 2026-07-03 — dirty-session-guard

## Done
- **The « garde-fou » slice from the UX backlog (web-only)**: one predicate —
  `ProjectSession.unsavedWork` — now guards every destructive path uniformly:
  - **Import**: the header « Importer » button arms a two-step « Confirmer ? »
    (relabel-in-place, blur/4 s revert) before the file picker opens over a
    session holding unsaved work.
  - **Reload/close**: new `useUnloadGuard` hook — `beforeunload` is prevented
    (+ legacy `returnValue`) while the session holds unsaved work, so the
    browser shows its native leave prompt.
  - **Project open**: `confirmBeforeOpen` switched from `isLoaded` to
    `unsavedWork` — a **clean saved session now opens a project in one click**
    (the confirm was pure friction there); anything unsaved still confirms.
- **Predicate semantics** (settled by the high-effort review): with a saved
  project → `dirty` (signature drift); without one → **a loaded track is
  itself unsaved work** (`loadedBytes !== undefined`). First cut compared the
  live signature to an empty-session signature, which silently declassified a
  freshly imported (never-saved) track — the review caught that as a
  regression vs the old `isLoaded` open guard, and the fingerprint can't see
  tempo/pitch either. The bytes-based test covers both.
- **Refactor under green**: the two-step confirm state machine (armed state +
  revert timer + unmount cleanup, `CONFIRM_REVERT_MS`) was duplicated between
  the new import button and the projects dialog's `RowAction` — extracted to a
  shared `useTwoStepConfirm<T>()` (`app/ui/use-two-step-confirm.ts`), both
  call sites migrated. A stale armed « Confirmer ? » also disarms during
  render if the session settles (e.g. a save lands) while armed.
- 9 new shell specs (arm/confirm/direct picker, blur disarm, beforeunload
  both ways, direct open when clean, confirm on dirty open); the four
  reopen-flow specs got their confirm click back (a detached loaded session
  confirms again), the two clean-attached open flows lost theirs.

## Not done / remaining
- **Browser click-through pending — must run on the Mac.** This WSL2 PC has
  no Chrome at all (chrome-devtools MCP can't launch; noted in memory). To
  verify: import a track → « Importer » shows « Confirmer ? » first; reload →
  native leave prompt; save → chip « Enregistré », then « Importer » and
  Ctrl-R pass without prompting; « Projets » → open over the clean session is
  one click, over a dirty one asks « Confirmer l'ouverture ».
- Tempo/pitch/zoom are still invisible to the fingerprint AND to the saved
  project — the backlog item « tempo/pitch/zoom persistence » is the real fix
  (the bytes-based predicate shields the detached case meanwhile).
- The import guard lives at the header button (the only picker entry point).
  A future second entry point (drag & drop) must consult `unsavedWork` too —
  `onFilePicked` itself stays unguarded by design (the file is already picked
  there; blocking would lose the pick).

## Decisions
- **A loaded track that no saved project holds IS unsaved work** — even bare:
  the audio lives only in the session, and invisible state (tempo/pitch) may
  ride on it. Uniform guard = `attached ? drift : loaded`.
- **A clean saved session gets NO confirm anywhere** (import, reload, open) —
  guards protect work, they don't tax the saved state. This deliberately
  relaxes the old open-confirm (`isLoaded`) for the attached-clean case.
- Two-step « Confirmer ? » is the house pattern for destructive/replacing
  actions (shared `useTwoStepConfirm`), not a modal or `window.confirm`.

## Gate status
- typecheck: ✅ (via `pnpm gate`, exit 0)
- tests (with coverage): ✅ 425 passed / 425 (9 specs added)
- mutation (Stryker, local, if core touched): **skipped — core untouched**
  (`packages/web` only; Stryker scope is `@app/core`)
- biome / sheriff / knip / jscpd: ✅ all green (jscpd clone count unchanged —
  the shared hook removed the would-be TSX duplicate)

## State to resume from
- **Single next action**: open the PR for `feat/dirty-session-guard`, then
  browser-verify the four flows above on the Mac before merging.
- Gotchas / half-done edits: none — working tree clean apart from this
  report. The shell spec suite now spies on
  `HTMLInputElement.prototype.click` for picker assertions; an
  `afterEach(vi.restoreAllMocks)` protects against spy leakage when an
  assertion fails mid-test (spies survive otherwise and pollute counts).
