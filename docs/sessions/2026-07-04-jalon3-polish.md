# Session — 2026-07-04 — jalon3-polish

Closes the three deferred **Jalon 3 polish** items in one sitting, each on its
own branch/PR (user chose « les trois à la suite »).

## Done

### 1. `separator-server/` → `server/` rename — PR #43 (`chore/rename-server-dir`)
Mechanical rename: the backend outgrew its name (it now hosts project storage +
Demucs separation + librosa tempo + yt-dlp download, not just separation).
- `git mv separator-server server` (tracked files). The gitignored `.venv` moved
  on disk with it; its **absolute paths** (bin shebangs, `activate`, `pyvenv.cfg`)
  were patched in place (`server/.venv` / `server`) so no torch/demucs reinstall.
- Updated active refs: `dev:server` script, biome + stryker ignore paths, the
  store-adapter comment, root `README.md`, backend `README.md` (title + intro).
- Verified: `pnpm dev:server` boots uvicorn from `server/`; `/health` ok; `app.main`
  imports 9 routes.

### 2. Rename a saved project — PR #44 (`feat/rename-project`)
A thin hexagonal slice.
- **Core** `renameProject({id,name,now},{store})`: load → trim name → save
  `{...project, name, updatedAt: now}`. Audio refs untouched → **no server
  change** (the existing `PUT /projects/{id}` persists the renamed manifest).
  Blank name / unknown id → error `Result`; name+clock injected. In `index.ts` +
  the application README.
- **Web** `useProjects.rename`; a « Renommer » `NameEditor` popover per row in the
  Projects dialog, pre-filled — the **same** rename popover loops/markers use.
- Core mutation: `renameProject`'s 24 mutants all killed.

### 3. Blob GC — PR #45 (`chore/blob-gc`)
Reclaim content-addressed audio blobs no manifest references (orphans from
re-saves + deletes). The `ProjectAudioStore` port deliberately has no `delete`;
its doc defers this to "a manifest-scan GC" in the adapter.
- `referenced_refs(manifests)` — **schema-agnostic**: an audio ref is any
  sha256-shaped string anywhere in the JSON, so the server never learns the
  `Project` shape (no false positives — nothing else is 64-hex).
- `collect_garbage()` → `{deleted, reclaimedBytes, kept}`; **conservative** —
  aborts without deleting if any manifest is unreadable (`{skipped:true}`).
- Exposed as `POST /gc` + a **lifespan boot sweep** (idle → can't race an upload).
- New minimal server test infra (`requirements-dev.txt` + `tests/`), 6 pytest
  cases over the GC. Live-verified: referenced blob kept (200), orphan gone (404).

## Not done / remaining
- **Browser-verify the project rename** on the Mac (low risk — reuses the proven
  `NameEditor` + the existing save endpoint; covered by integration tests). Needs
  `pnpm dev` up.
- **No UI trigger for GC** — it runs on boot + `POST /gc`; a user-facing button
  wasn't in scope (maintenance op). Add later if wanted.
- The three PRs are open, **not yet merged**.

## Decisions
- **GC is the server adapter's business, kept schema-agnostic.** The manifest-scan
  GC lives entirely server-side (outside the hexagon) and treats manifests as
  opaque — matching the `ProjectAudioStore` port contract. No core change.
- **Rename reuses `load`+`save`, no new port / no server change** — a rename is a
  pure manifest edit; audio refs never move.
- **Server keeps the name `server/`** — reflects its four capability groups, not
  just separation.

## Gate status
- typecheck: ✅ (all three)
- tests (with coverage): ✅ — web/core **535** (rename) / **527** (rename & GC branches
  are off the same base); server **6** pytest (GC).
- mutation (Stryker, local): rename — **94.65 %** overall, `projects.ts` 97.17 %
  (all 3 survivors pre-existing in `saveProject`; `renameProject` 100 % killed).
  Rename-server & GC touched no mutated package → skipped.
- biome / sheriff / knip / jscpd: ✅ (15-clone jscpd baseline unchanged).

## State to resume from
- **Single next action**: merge PRs #43 → #44 → #45 (any order — independent, all
  off `main`), then pick the next slice.
- Gotchas / half-done edits:
  - **venv location follows the branch.** PRs #44/#45 are off `main` (dir is
    `separator-server/`, venv at `separator-server/.venv`). PR #43 renames it to
    `server/`. After #43 merges, recreate/repatch the venv under `server/.venv`
    (the `dev:server` script points there). Switching between a `server/`-branch
    and a `main`-branch leaves an **orphan venv dir** on disk (git leaves the
    gitignored `.venv` behind) — delete the stray dir so biome doesn't scan its
    vendored `.js`.
  - Next-slice candidates unchanged: off-thread zip/encode (perf), speed trainer /
    undo (UX), or Jalon 4 (export MIDI per stem — basic-pitch).
