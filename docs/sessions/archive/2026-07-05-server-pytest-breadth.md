# Session — 2026-07-05 — server-pytest-breadth

Slice **B.1** of [docs/roadmap-excellence.md](../roadmap-excellence.md) — broaden
server test coverage so the security-critical modules aren't flying blind. Branch
`test/server-pytest-breadth`.

## Done
- **`test_projects_api.py`** (minimal torch-free app, `projects.router` only):
  audio put/get/head, content-addressing idempotence, unknown + malformed refs,
  project CRUD roundtrip, non-JSON manifest → 400, corrupt-manifest skip, GC
  summary → **projects.py 100 %**.
- **`test_download_stream.py`**: unsupported URL → single error, happy-path
  `progress → done` (fake `_extract` + stubbed `store_audio`, no network), optional
  metadata fallback, no-file + generic-error paths, NDJSON route → **download.py
  86 %**.
- **`test_main_fallbacks.py`**: proves the app still serves storage when
  separation/tempo/download are absent — a fresh `app.main` imported with those
  submodules forced missing (`sys.modules[...] = None`), so it's torch-free and
  fast; covers all three fallbacks, `/health` with no model, and the boot-time GC
  via the client context manager → **main.py 100 %**.
- Added `pytest-cov`; gitignored `.coverage` / `.pytest_cache` / `htmlcov`.

## Not done / remaining
- **`separation.py` (41 %) and `tempo.py` (44 %) stay low by design** — they are
  the torch/librosa **humble objects**; the decidable logic was already extracted
  to `stems_store` / `limits` (100 % / 93 %). Their inference/DSP paths stay
  manually covered. **B.3** will formalise this convention (and extract any
  remaining testable pockets, e.g. tempo's `_load_mono`, the stem re-ordering).
- **B.2** — wire `ruff` + `pyright` + a `server` CI job (with a coverage gate);
  the server is still outside CI.
- download's remaining misses (54-55, 68, 80-101, 144) are the real yt-dlp glue
  (`_make_options`, the progress hook, live `_extract`) — I/O, not unit-testable
  without a network run.

## Decisions
- **Coverage targets are per-module, matched to risk.** The security-critical
  request handlers (`projects`, `download`, `main`) are held ≥ 80 %; the ML humble
  objects are exempted and covered manually — the server analogue of "test the
  decidable core, not the adapters".

## Gate status
- JS/TS gate: **green** (pre-commit; server change doesn't touch it).
- **server pytest**: `.venv/bin/python -m pytest --cov=app` → **70 passed**,
  **TOTAL 79 %** — projects **100 %**, main **100 %**, download **86 %**, limits
  **100 %**, netguard **100 %**, stems_store **93 %** (separation 41 %, tempo 44 %
  by design).
- mutation (Stryker): **skipped** — no `@app/core` touched.

## State to resume from
- **Single next action**: start **B.2** — add `ruff` + `pyright` config for
  `server/app`, a coverage floor, and a **`server` job in
  [.github/workflows/ci.yml](../../.github/workflows/ci.yml)** (setup Python, cache
  pip, `pip install -r requirements-dev.txt`, then ruff + pyright + `pytest --cov`).
  Pin `requirements.txt` to precise versions with a manual-update note.
- Gotchas / half-done edits: none. `CLAUDE.md` still shows modified in
  `git status` (pre-existing, unrelated). Shell cwd drifts into `server/` — check
  `git branch --show-current` before each commit. `test_main_fallbacks` mutates
  `sys.modules` but restores the original `app.main`; keep that teardown intact.
