# Session — 2026-07-05 — server-resource-limits

Slice **A.3** of [docs/roadmap-excellence.md](../roadmap-excellence.md) — the
🟡 medium findings from the 2026-07-05 security review. Branch
`fix/server-resource-limits`.

## Done
- **Body-size caps** (new [server/app/limits.py](../../server/app/limits.py)).
  `read_capped_body` refuses a body over an env-tunable cap **before buffering** —
  declared `Content-Length` up front, then chunk-by-chunk so a lying/absent length
  can't slip through. Wired into `/audio`, `/separate`, `/tempo`
  (`LOUPE_MAX_UPLOAD_MB`, default 500) and manifests (`LOUPE_MAX_MANIFEST_MB`,
  default 16). Closes the trivial OOM/disk-fill DoS.
- **`/separate` concurrency bounded** by a `BoundedSemaphore`
  (`LOUPE_MAX_CONCURRENT_SEPARATIONS`, default 1) around `apply_model`, so parallel
  inferences can't thrash/OOM the device.
- **Stem temp dir hardened** (new torch-free
  [server/app/stems_store.py](../../server/app/stems_store.py)): `0700` job dirs
  (other local users can't read a user's stems), an age-based TTL sweep on each
  separation (`LOUPE_STEMS_TTL_SECONDS`, default 3600) so WAVs don't accumulate,
  and job/stem path validation on `/stems`. Split out of `separation.py` (which
  loads Demucs on import) so the logic is CI-testable without the ML stack.
- **Generic client-facing errors**: separation / tempo / download now log full
  detail server-side (`logging.getLogger("loupe.*")`) and return a generic message
  so internals/paths don't leak (esp. reachable cross-origin). The A.1 actionable
  yt-dlp-upgrade hint is kept (it leaks nothing).
- **New pytest**: [test_limits.py](../../server/tests/test_limits.py) (cap up
  front + streamed + no-header), [test_stems_store.py](../../server/tests/test_stems_store.py)
  (0700 perms, resolve valid/missing, malformed-segment rejection incl. traversal,
  TTL sweep). Both torch-free.
- README updated (env vars + the corrected "swept by age" note).

## Not done / remaining
- **Lot A last slice — A.4**: assert loopback binding at startup (warn/refuse on a
  non-loopback `--host`) + sanitise `exportBaseName` output (strip `/ \` + control
  chars) on the web side.
- Concurrency is serialised, not queued with feedback — a second `/separate` waits
  silently until the first finishes. Acceptable for single-user; revisit if needed.
- IPv6 `[::1]` Host still needs an explicit allowlist entry (noted in A.2).

## Decisions
- **The localhost server defends its resources**: every body-reading endpoint is
  capped before buffering, inference is serialised, stem files are private + TTL'd,
  and client errors are generic. Supersedes the README's "jobs live until the
  process exits".

## Gate status
- typecheck / biome / sheriff / knip / jscpd: **green** (pre-commit `pnpm gate`).
- **server pytest**: `.venv/bin/python -m pytest` → **36 passed** (21 + 15 new).
- **Real uvicorn check** (curl): 2 MB body over a 1 MB cap → **413**; 100 KB → 200;
  malformed `/stems` job → **404**; jobs dir `drwx------` (0700).
- mutation (Stryker): **skipped** — server-only Python, no `@app/core` touched.

## State to resume from
- **Single next action**: **A.4** — add a startup loopback-binding assertion in
  [server/app/main.py](../../server/app/main.py) and sanitise
  [packages/web/src/lib/export-base-name.ts](../../packages/web/src/lib/export-base-name.ts).
  Then **Lot B** (server pytest breadth + ruff/mypy + a CI job).
- Gotchas / half-done edits: none. `CLAUDE.md` still shows modified in
  `git status` (pre-existing, unrelated — don't stage). Note: the Bash shell cwd
  drifted to `server/` and a stray `git checkout main` put HEAD on main mid-slice
  — re-branched onto `fix/server-resource-limits` before committing; verify
  `git branch --show-current` before any commit.
