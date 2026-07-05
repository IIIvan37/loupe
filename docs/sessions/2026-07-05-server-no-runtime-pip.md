# Session — 2026-07-05 — server-no-runtime-pip

Slice **A.1** of [docs/roadmap-excellence.md](../roadmap-excellence.md) — the first
security fix after the 2026-07-05 four-axis evaluation (fonctionnalité / qualité /
UX-UI / sécurité). Branch `fix/server-no-runtime-pip`.

## Done
- **Removed the runtime `pip install` on the download path** (the 🔴 critical
  finding). [server/app/download.py](../../server/app/download.py) dropped
  `_upgrade_yt_dlp()` (`subprocess pip install -U yt-dlp` + `importlib.reload`)
  and the retry-on-upgrade; the now-unused `subprocess` / `sys` / `importlib`
  imports are gone. A `yt_dlp.utils.DownloadError` now yields an actionable NDJSON
  error — « run `pip install -U yt-dlp` in the server venv and retry » — so a
  request never triggers a package install.
- **New pytest** [server/tests/test_download_no_runtime_pip.py](../../server/tests/test_download_no_runtime_pip.py):
  locks the invariant (DownloadError → actionable message, no subprocess; the
  `_upgrade_yt_dlp` helper and `subprocess` attr must stay deleted) and adds
  host-allowlist accept/reject coverage (suffix-spoof, non-http scheme) — an early
  down-payment on Lot B.1.
- Roadmap doc [docs/roadmap-excellence.md](../roadmap-excellence.md) landed on
  `main` (doc-only) as the guide for the coming sessions.

## Not done / remaining
- **Lot A continues**: A.2 (CORS `*` → dev origin + `Host` validation, 🟠), A.3
  (request-size caps, stems-temp TTL/0700, generic error messages), A.4 (loopback
  binding assertion + `exportBaseName` sanitising).
- The A.1 error message is still a specific string; **Lot A.3** will genericise
  client-facing error text (log full detail server-side). Left as-is here on
  purpose — the actionable hint is useful until A.3.
- **Server is still outside the gate/CI** — ruff/mypy/pytest-in-CI is **Lot B.2**.

## Decisions
- **Dependency upgrades are an operator action, never a request-path side effect.**
  A stale extractor surfaces a manual-upgrade hint instead of self-installing.
  This is the durable rule behind A.1; supersedes the old STATUS note
  ("auto-retry + pip -U yt-dlp on failure").

## Gate status
- typecheck / biome / sheriff / knip / jscpd: **green** (pre-commit `pnpm gate`
  passed — jscpd 7 clones, unchanged; the JS/TS gate does not cover `server/`).
- tests (with coverage): web/core gate **green**, 542 tests.
- **server pytest**: `.venv/bin/python -m pytest` → **15 passed** (5 GC + 10 new).
- mutation (Stryker): **skipped** — this step touched no `@app/core` (server-only
  Python).

## State to resume from
- **PR #48 opened** for this branch (report ships inside).
- **Single next action**: start **A.2** — replace `allow_origins=["*"]` in
  [server/app/main.py](../../server/app/main.py) with the dev origin + a `Host`
  validation middleware.
- Gotchas / half-done edits: none. `CLAUDE.md` shows as modified in `git status`
  but that change predates this session and is unrelated — do not stage it here.
  Server has **no ruff yet**, so lint isn't enforced on the Python change (B.2).
