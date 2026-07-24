# Session — 2026-07-05 — server-cors-host

Slice **A.2** of [docs/roadmap-excellence.md](../roadmap-excellence.md) — the
🟠 high finding from the 2026-07-05 security review. Branch `fix/server-cors-host`.

## Done
- **Scoped CORS to the dev origin.** [server/app/main.py](../../server/app/main.py)
  replaced `allow_origins=["*"]` with `LOUPE_ALLOWED_ORIGINS` (default
  `http://localhost:5173,http://127.0.0.1:5173`) via an `_env_list` helper — a
  random page in the same browser can no longer read our responses.
- **Added `TrustedHostMiddleware`** (`LOUPE_ALLOWED_HOSTS`, default
  `localhost,127.0.0.1`), outermost so a rebinding request is refused before
  routing — blunts DNS-rebinding, which would otherwise reach us over loopback
  despite CORS.
- **New pytest** [server/tests/test_cors_and_host.py](../../server/tests/test_cors_and_host.py)
  via FastAPI `TestClient`: allowed host 200, bad host 400, dev origin echoed,
  foreign origin not echoed (nor `*`), preflight rejects foreign origin,
  `_env_list` trims/drops blanks. Added `httpx` to
  [requirements-dev.txt](../../server/requirements-dev.txt) (TestClient transport).
- Documented both guards + the `--host 0.0.0.0` warning in
  [server/README.md](../../server/README.md).

## Not done / remaining
- **Lot A continues**: A.3 (request-size caps, stems-temp TTL/0700, generic
  client-facing error messages), A.4 (loopback-binding assertion +
  `exportBaseName` sanitising).
- Optional hardening deferred: a per-session shared-secret header (even one
  trusted origin + rebinding is weak); revisit if the tool ever leaves loopback.
- `TrustedHostMiddleware` strips the port before matching, so IPv6 `[::1]` Host
  headers would not match the defaults — acceptable (dev uses localhost/127.0.0.1);
  add `[::1]` to `LOUPE_ALLOWED_HOSTS` if needed.

## Decisions
- **Trust model = "only the local loupe web app talks to this server."** Enforced
  by scoped CORS + Host validation, both env-overridable but loopback by default.
  Supersedes the old `allow_origins=["*"]`.

## Gate status
- typecheck / biome / sheriff / knip / jscpd: **green** (pre-commit `pnpm gate`).
- **server pytest**: `.venv/bin/python -m pytest` → **21 passed** (15 + 6 new).
- **Real uvicorn check** (curl): dev origin → `access-control-allow-origin`
  echoed; foreign origin → no CORS header; bad Host → **400**; `/health` ok
  (device `mps`, Demucs present).
- mutation (Stryker): **skipped** — server-only Python, no `@app/core` touched.

## State to resume from
- **Single next action**: start **A.3** — add a request-body size cap (reject
  bodies over N MB before buffering) across
  [projects.py](../../server/app/projects.py) / [separation.py](../../server/app/separation.py)
  / [tempo.py](../../server/app/tempo.py); TTL + `0700` on the `loupe-stems` temp
  dir; genericise client-facing error strings (log full detail server-side).
- Gotchas / half-done edits: none. `httpx` is now a dev dep — CI (Lot B.2) must
  `pip install -r requirements-dev.txt` before pytest. `CLAUDE.md` still shows
  modified in `git status` (pre-existing, unrelated — don't stage).
