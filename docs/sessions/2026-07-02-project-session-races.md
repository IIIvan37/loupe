# Session — 2026-07-02 — project-session-races

## Done
- **Browser-verified J3.3 save/open on `main`** (post PR #28/#29): import → save →
  reload → open restores markers/loops (localStorage cleared to prove the server
  is the source), stems + mixer restore on a real project, two-step delete,
  confirm-before-open (incl. its 4 s auto-revert), server-offline banner + status
  dot + recovery. Verdict **FAIL** — the click-through exposed a silent data
  loss: after opening a project, importing a new file kept `currentId`, so the
  one-click « Enregistrer » **overwrote the open project in place** (old name,
  separation dropped). Reproduced live on disk, project restored from backup.
- **Fixed the data loss** (b8b32b9): `useProjects.detach()`, called on every new
  import — the next save mints a fresh project id and the header falls back to
  the named first-save popover. TDD: 2 hook tests + 2 shell acceptance tests.
- **Branch code review (8 finder angles + verify)** then **fixed the three
  confirmed races** (168a0a7), all "async op resolves after the session moved
  on": a stale save re-attaching `currentId` after a detach (re-creating the
  overwrite through a timing window), a stale open clobbering a file imported
  meanwhile (the dialog stays dismissible mid-open), and a superseded import
  applying its decode outcome (state, error, engine load) over the newer one.
  Session generation in `useProjects` (shared by `detach`/`remove`), import
  epoch in the shell, supersede guard in `importFile`.
- **Extracted `useProjectSession`** (colocated smart hook): the whole
  project ↔ session lifecycle (save/open/detach-on-import) out of
  `WorkstationShell`, which was past the 300-line react-doctor ceiling.
- **Migrated all web specs to `@testing-library/user-event`** (466f6cd, ~80 call
  sites, 11 files) and **installed a project skill**
  `.claude/skills/react-testing-patterns/SKILL.md` (adapted from
  hieutrtr/ai1-skills, MIT): query priority, `findBy*` over `waitFor`, the two
  legitimate `act()` uses, hexagonal fakes instead of MSW, and the four
  documented `fireEvent` exceptions (range sliders, coordinate pointer gestures,
  layout-dependent keyboard tests, `vi.useFakeTimers` — `user.click` hangs on
  the fake clock even with `advanceTimers`).

## Not done / remaining
- **PR to open** for this branch (fix + races + test idiom + skill).
- **Per-project loops** (decided this session, see Decisions): loops leave
  localStorage and become part of the project/session — next slice, own branch.
- Review findings deferred as cleanup: shared in-memory `ProjectDeps` fake
  (currently duplicated between `use-projects.spec.tsx` and
  `workstation-shell.spec.tsx`, and the skill points at the spec-local helper);
  `userEvent.setup()` hoisted into the per-file render helpers (~16 sites);
  `saveProjectAs` body re-inlined in the failed-save test; dead `user.clear` on
  always-empty NameEditor fields.
- Save-after-failed-import is untested and its behavior changed implicitly (a
  failed decode now detaches → a save mints a duplicate instead of overwriting
  the open project with a gutted session — safer, but decide + test it).
- Stale project error banner survives a new import (pre-existing; `detach()`
  would be the natural place to clear it).

## Decisions
- **Loops become per-project** (user decision, 2026-07-02): the localStorage
  `LoopStore` goes away; loops live in session memory, are cleared by
  `startFreshTrack`, and persist only through the project manifest (which
  already stores and restores them). Replaces the "per-project loops" backlog
  entry with a committed direction.
- Session-lifecycle invariant, now encoded in `useProjectSession`: **any session
  reset not sourced from a saved project must detach** (import bumps the epoch +
  detaches; open must stay attached). A stale async resolution never re-attaches
  or restores — guarded by generation (hook) + epoch (shell).
- Testing idiom is codified in the `react-testing-patterns` skill; `user-event`
  is the default, `fireEvent` only for the four listed exceptions.

## Gate status
- typecheck: ✅
- tests (with coverage): ✅ 348 tests, 45 files
- mutation (Stryker, local, if core touched): **skipped — `@app/core` untouched**
  (all changes in `packages/web` + `.claude`; Stryker scope is core-only)
- biome / sheriff / knip / jscpd / impeccable / react-doctor: ✅ (`pnpm gate`
  green; react-doctor findings fixed along the way — shell size via the hook
  extraction, await-before-guard via a nested guard in `use-player`)

## State to resume from
- **Single next action**: open the PR for `fix/import-detaches-saved-project`
  (3 commits: b8b32b9, 466f6cd, 168a0a7 + this report), then start the
  **per-project loops** slice on a fresh branch off `main` once merged.
- Gotchas / half-done edits: none in the tree (clean, gate-green). The
  verification session's Cure project was copied additively into `~/.loupe`
  (manifest + 6 content-addressed blobs) so a normal `pnpm dev` finds it. The
  dev servers from the verification session may still be running (uvicorn on
  :8000 with a scratch `LOUPE_DATA_DIR`, Vite on :5173) — kill and relaunch
  `pnpm dev` for the standard data dir.
