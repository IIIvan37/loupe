# Session — 2026-07-05 — server-humble-objects

Slice **B.3** of [docs/roadmap-excellence.md](../roadmap-excellence.md) — formalise
the humble-object convention and pull the last testable logic out of the ML shells.
**Closes Lot B.** Branch `refactor/server-humble-objects`.

## Done
- **`stem_manifest.py`** (new, torch-free): `STEM_META` + `DISPLAY_ORDER` +
  `build_manifest(sources, job, base_url)` — orders Demucs' native source list into
  the stable UI layout and maps each to its `id`/`label`/`url` (`StemEntry`).
  Moved out of `separation.py`, which now just runs the model and writes the WAVs
  this plans (`audio = stems[sources.index(entry.source)]` → `_save_wav`).
- **`download.progress_fraction(status)`** (extracted): the yt-dlp progress-hook
  math is now a pure function; `on_progress` is a two-line shell over it.
- **Tests** (torch-free): `test_stem_manifest.py` (6-stem ordering, 4-stem subset,
  id/label/url mapping, unknown-source title-case fallback sorting last) and
  `test_download_progress.py` (total vs estimate, cap at 1.0, the None paths).
- **`server/README.md`**: a "Convention — humble objects" section — decidable logic
  goes in torch/yt-dlp-free modules; the ML modules stay thin shells; **add server
  logic in a torch-free module, don't grow the shells**.

## Not done / remaining
- **Lot B is complete.** Next is **Lot C** (produit): **C.1** (drag-and-drop +
  a real empty-state) is the first visible win.
- The refactor is **behaviour-preserving** — `build_manifest` reproduces the old
  inline ordering/mapping exactly (unit-proven), so a full end-to-end separation
  was **not** re-run (heavy; needs a real track). `separation.py` imports clean and
  the manifest logic is unit-covered.
- `separation.py`/`tempo.py` remain the excluded shells; their decidable pockets
  are now extracted, so what's left there genuinely needs torch/librosa.

## Decisions
- **Humble-object convention is now written down** (README) and enforced by shape:
  torch-free modules are pyright- + coverage-gated in CI; the ML shells are not.
  This is the durable answer to "the server felt lower-quality / not hexagonal" —
  it's an adapter, and its analogue of purity is the humble object.

## Gate status
- JS/TS gate: **green** (pre-commit; server-only change).
- **server checks**: `ruff check` ✓, `ruff format --check` ✓, `pyright` **0
  errors**, `pytest` **80 passed, 96.83 %** (download **90 %** ↑ from 86,
  `stem_manifest` **100 %**; floor 80).
- mutation (Stryker): **skipped** — no `@app/core` touched.

## State to resume from
- **Single next action**: start **Lot C.1** — drag-and-drop import + a real
  empty-state/drop-zone in the web app. Reuse the existing import path
  (`useImportFromUrl` / `session.importDownloaded`); new `empty-state` component in
  [packages/web/src/app/workstation-shell/](../../packages/web/src/app/workstation-shell/);
  the unsaved-work guard reused. **Browser-verify** (it's a UI slice) and follow
  TDD for any pure bits. This re-enters the web/core gate (`pnpm gate`) + mutation
  if core is touched.
- Gotchas / half-done edits: none. `CLAUDE.md` still shows modified in
  `git status` (pre-existing, unrelated). Server checks run only in the `server`
  CI job, not `pnpm gate` — run the three `.venv/bin/...` commands locally.
