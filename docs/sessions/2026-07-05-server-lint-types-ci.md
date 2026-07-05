# Session — 2026-07-05 — server-lint-types-ci

Slice **B.2** of [docs/roadmap-excellence.md](../roadmap-excellence.md) — bring the
server into the blocking quality loop, the last structural gap. Branch
`ci/server-lint-types-ci`.

## Done
- **`server/pyproject.toml`** — one config home:
  - `ruff` (E/F/I/B/C4/UP/SIM, line-length 100).
  - `pyright` (basic). **Excludes** `app/separation.py` + `app/tempo.py` (torch/
    librosa humble objects) so type-checking runs torch-free.
  - `pytest` + coverage with an **80 % floor**; `separation`/`tempo` omitted from
    coverage (they aren't imported torch-free, so measuring them would make the
    number depend on whether torch is installed).
- **`ruff --fix` + `ruff format`** applied across `app`/`tests` (import order,
  `collections.abc.Iterator`, de-quoted annotations, reflow to 100 cols). Four
  unavoidable third-party typing frictions (yt-dlp `_Params`/`_InfoDict`/`utils`,
  demucs private `tqdm`) suppressed with precise `# pyright: ignore[rule]`.
- **Dependencies**: `requirements.txt` pinned to exact versions (no surprise
  upgrades, cf. A.1); `requirements-dev.txt` rewritten as a **light, torch-free**
  set (fastapi/uvicorn/yt-dlp + test+lint tools) so CI is fast and never downloads
  Demucs weights.
- **CI**: new **`server` job** in [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
  — setup-python 3.12 → venv → `ruff check` → `ruff format --check` → `pyright` →
  `pytest`.
- README: quality section mirroring the CI job.

## Not done / remaining
- **B.3** — write the humble-object convention into `server/README.md` explicitly
  and extract any remaining testable pockets from `separation.py`/`download.py`
  (stem re-ordering/mapping, progress math) into torch-free modules.
- Then **Lot C** (produit): C.1 DnD + empty-state is the first visible win.
- `pyright` is pinned by a floor (`>=1.1.380`) not exact — it bootstraps a node
  runtime; keeping it loose avoids churn. Revisit if CI flakes on a pyright bump.

## Decisions
- **The server now has its own blocking gate, run torch-free.** Type-checking and
  coverage deliberately scope to the decidable modules; the ML I/O boundary is
  excluded and covered manually. This is the server analogue of the core's purity
  gate — same discipline, adapter-appropriate shape.

## Gate status
- JS/TS gate: **green** (pre-commit).
- **server checks (validated in a throwaway torch-free venv, exactly like CI)**:
  `ruff check` ✓, `ruff format --check` ✓, `pyright` **0 errors** (torch-free
  interpreter), `pytest` **70 passed, 94.96 %** (floor 80 met).
- mutation (Stryker): **skipped** — no `@app/core` touched.

## State to resume from
- **Single next action**: start **B.3** — add the humble-object convention to
  `server/README.md` and extract testable logic still living inside
  `separation.py` (the `DISPLAY_ORDER`/`STEM_META` re-ordering into a manifest) and
  `download.py` (progress fraction) into torch-free, unit-tested helpers.
- Gotchas / half-done edits: none. **New**: `pnpm gate` still does NOT run the
  server checks — they run only in the `server` CI job. If you want them locally
  in one shot, run the three `.venv/bin/...` commands (see `server/README.md`).
  `CLAUDE.md` still shows modified in `git status` (pre-existing, unrelated).
  Verify the `server` CI job goes green on the PR before merging.
