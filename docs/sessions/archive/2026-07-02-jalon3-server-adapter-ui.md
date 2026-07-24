# Session — 2026-07-02 — jalon3-server-adapter-ui

## Done

- **Slice J3.3 — real adapter + UI for project persistence** on branch
  `feat/jalon3-project-server-ui`. **Decision resolved: extended HTTP server**
  (not Tauri, not IndexedDB) — no new toolchain, works on every dev machine,
  Tauri stays possible later behind the same ports.
- **Server** (`separator-server/`): split into `projects.py` (new — manifest
  CRUD + audio blobs) and `separation.py` (the former main, unchanged
  contract); `main.py` assembles both and imports separation **lazily**, so a
  host without PyTorch still serves storage and `/separate` answers a clean
  NDJSON error line. Blobs are **content-addressed** (sha256 → ref, atomic tmp
  +rename writes, idempotent re-put) per the `ProjectAudioStore` contract note;
  data under `LOUPE_DATA_DIR` (default `~/.loupe`). Path-traversal guarded
  (ref/id regexes). **Curl-verified end-to-end on this torch-less WSL2 PC.**
- **Web adapters**: `createHttpProjectStore` / `createHttpProjectAudioStore`
  (`packages/web/src/projects/`, 8 tests, fetch faked) + `createProjectStores`
  factory on `VITE_SEPARATOR_URL ?? http://localhost:8000`.
- **Core (TDD)**: `mixerReducer` gained a `restore` action (adopts a persisted
  `MixerState`, re-clamped) — needed to seat saved faders/mute/solo.
- **UI**: header gains « Enregistrer » (NameEditor popover; name defaults to
  current project/track) and « Projets » (list dialog: open/delete, empty
  state). `useProjects` mints the stamp (`currentId ?? randomUUID`,
  `Date.now()`) so re-saving updates in place. Save snapshots the live session
  (`project-session.ts`): original file bytes (now retained by `usePlayer`),
  stems re-encoded via `encodeWav` **filtered to the mixer's channels**
  (mixer↔stems invariant), mixer state. Open rebuilds everything: re-import
  bytes, restore markers/loops (loops best-effort persisted), `decodeWav` each
  stem, replay the separation pipeline (fake separator through the real
  use-case, so waveforms + detection re-run), seat the saved mixer.
- Gate-pulled refactors: shared `AppDialog` frame (shortcuts + projects
  dialogs), loop-region editing extracted to `use-loop-editing.ts`, session
  glue in `project-session.ts`. Stryker now ignores `separator-server/`
  (the new `.venv` broke its sandbox copy).

## Not done / remaining

- **Browser verification pending** — the full save→list→open flow was proven
  by unit/integration tests + curl against the real server, but not yet
  clicked through in the running app (previous slices' usual follow-up).
- Blob GC (orphaned audio on delete/re-save with changed bytes) — deliberate
  J3.2 deferral, unchanged; content-addressing bounds the growth.
- `separator-server/` name is now stale (it also stores projects) — rename to
  `server/` considered, deferred (touches README/scripts).
- Tempo/pitch/zoom aren't part of the `Project` model (J3.1 scope) — not
  persisted.
- Jalon 2 export (J2.6) still open.

## Decisions

- **Backend = extended HTTP server** (user-confirmed). The same single server
  hosts separation (optional, torch-gated) and projects (always).
- **Content-addressed refs server-side** (sha256) — implements the port's
  recommendation: re-saves dedupe, orphans stay GC-able.
- Storage must not require the ML stack: separation is a lazily-imported,
  gracefully-absent capability group.

## Gate status

- typecheck / biome / sheriff / knip / jscpd / impeccable / react-doctor: ✅
  (`pnpm gate` exit 0, also at pre-commit)
- tests (with coverage): ✅ **316 passed** (was 291; +25)
- mutation (Stryker, local): ✅ **96.28%** (core `mixer.ts` restore covered)

## State to resume from

- **Single next action**: browser-verify the flow (start `pnpm dev` — uvicorn
  needs only fastapi+uvicorn, `.venv` here has them: `separator-server/.venv`;
  import a track, save, reload, open, check markers/loops/stems/mixer), then
  open the PR for `feat/jalon3-project-server-ui`.
- Gotchas: on this WSL2 PC `/separate` correctly degrades (no torch) — test
  the separation half of open/save on the Mac or accept source-only projects
  here. `useMixer.restore` drops saved channels whose stem is re-detected as
  absent (graceful). Loops restore replaces the localStorage library.
