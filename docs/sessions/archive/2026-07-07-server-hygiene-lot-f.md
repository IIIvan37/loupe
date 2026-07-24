# Session — 2026-07-07 — server-hygiene-lot-f (opens roadmap-excellence-2)

First lot of [roadmap-excellence-2.md](../roadmap-excellence-2.md): **Lot F —
hygiène immédiate**, the four server/doc debts flagged by the 2026-07-06
evaluation. Server + docs only, no product-visible change. On branch
`fix/server-hygiene-lot-f` (off `main`, tempo plan closed with PR #69 merged).

## Done
- **F.1 — `/download` body cap (🔴 critique)**: the route no longer buffers an
  unbounded body via `await request.json()` — the last body-reading endpoint
  that had escaped the Lot A caps. It now reads through the shared cap
  (413 over `LOUPE_MAX_MANIFEST_MB`, 400 on non-JSON) and tolerates a non-object
  JSON body (previously an `AttributeError` → 500). Tests: over-cap → 413,
  non-JSON → 400, JSON array → clean NDJSON error.
- **F.2 — `/tempo` inference bound (🟠)**: beat_this inference is bounded like
  `/separate` (`LOUPE_MAX_CONCURRENT_TEMPO`, default 1). Deliberately an
  **`asyncio.Semaphore` taken in the route** (not a threading semaphore inside
  the worker): queued requests wait on the event loop, holding **no threadpool
  token and no decoded signal** — a threading semaphore inside
  `run_in_threadpool` would have pinned anyio's ~40 shared tokens (the same pool
  the `/separate`/`/download` NDJSON streams iterate on) plus one decoded
  float32 signal per waiter (review finding, verified against starlette/anyio
  sources).
- **F.4 — WAV decode extracted**: new torch-free
  [wav_decode.py](../../server/app/wav_decode.py) (`decode_wav` [frames,
  channels] + `decode_wav_mono`), tested (6 tests incl. full-scale mapping and
  the mono fold) and pyright-checked. `tempo.py` lost `_load_mono`;
  `separation.py`'s `_load_mix` keeps only the torch half (tensor, resample,
  mono→stereo) — the sharing was natural, both decoded identically. Hardened in
  review: **non-16-bit WAVs are refused** (`ValueError` → the routes' 400)
  instead of silently misdecoded as garbage; scaling divides in place (one
  full-size float32 allocation instead of two).
- **F.3 — READMEs resynced**: [server/README.md](../../server/README.md) now
  says beat_this (not librosa), documents the enriched `/tempo` contract
  (`beats: [{time, position}]`, checkpoint/device env vars), lists the new
  torch-free modules and both concurrency env vars, and covers the `/download`
  cap. (The core application README half of F.3 was already resynced during
  the Lot C session.)
- **New shared helpers in `limits.py`** (both review-driven DRY):
  `concurrency_slots(env)` (env-parse shared by both semaphores) and
  `read_capped_json(request, max_bytes, detail)` → `(bytes, parsed)` — the
  cap-then-parse-then-400 policy now has one home; `projects.save_project` and
  `/download` both use it (behaviour-preserving, same codes/messages).
- **numpy made an explicit dependency** (review finding, CONFIRMED CI breaker):
  `wav_decode.py` imports numpy directly, but the torch-free CI venv
  (`requirements-dev.txt`) never installed it — pyright and pytest collection
  would have failed in CI while passing locally (the local venv has the ML
  stack). Pinned `numpy==2.4.6` in both requirements files.

## Not done / remaining
- **Deferred (review, altitude — candidates for a later hygiene pass):**
  1. The WAV **encode** half (`separation._save_wav`'s clip + asymmetric
     ±32768/32767 int16 scaling) still lives in the coverage-excluded torch
     shell; extracting `encode_wav` into `wav_decode.py` would let a round-trip
     test pin the scaling. Natural follow-up if the module is touched again.
  2. Body caps stay **per-endpoint**; a middleware-level default cap would make
     the `/download`-class miss impossible by construction. Roadmap material,
     out of a hygiene lot's scope.
- **Next lot**: roadmap-excellence-2 **Lot G** (confiance utilisateur —
  two-step suppression repère/boucle, culs-de-sac d'erreur import/tempo,
  feedback drop non supporté).

## Decisions
- **`/tempo`'s semaphore is async at the route, not threading in the worker**
  (deviation from a literal "même `BoundedSemaphore` que `/separate`"): same
  bound, but waiters must not consume the shared threadpool the NDJSON streams
  run on, nor hold decoded buffers. `/separate` itself is structurally similar
  (its semaphore waits on a dedicated thread) so it stays as is.
- **`decode_wav` refuses non-16-bit WAVs** rather than trusting the caller: read
  as int16 they produce right-shaped garbage (silent wrong BPM / corrupt stems),
  not an error. The 16-bit assumption is now enforced where it's encoded.
- Direct imports get explicit pins even when transitively satisfied
  (numpy) — the torch-free CI venv is the arbiter of what "torch-free" needs.

## Gate status
- typecheck: ✅ (via `pnpm gate`, twice — explicit + pre-commit hook)
- tests (with coverage): ✅ web **651 passed / 71 files** (untouched, statements
  95.71 %); server pytest **108 passed, 97.39 %** (+13 this session), ruff +
  format clean, pyright **0 errors**.
- mutation (Stryker, local, if core touched): **skipped — `@app/core`
  untouched** (server Python + docs only).
- biome / sheriff / knip / jscpd: ✅ (5 clones, pre-existing).
- Manual humble-object verify (local venv, MPS): real WAV through the actual
  `/tempo` route (TestClient) → **200, 120.0 BPM, 9 beats** through the async
  semaphore; `separation._load_mix` → stereo tensor `(2, 176400)` float32 via
  `decode_wav`.
- Code review (medium, 8 angles + verify): 6 confirmed findings **fixed**
  (numpy CI breaker, semaphore placement, non-16-bit WAV, `read_capped_json`
  dedup, unused `default` param, double allocation), 2 deferred (above),
  4 refuted.

## State to resume from
- **Single next action**: push + open the PR for `fix/server-hygiene-lot-f`
  (this report ships inside it), merge — Lot F is then closed. Next work:
  **roadmap-excellence-2 Lot G** (web-only, browser-verify required).
- Gotchas / half-done edits: none — branch clean, both gates green. The CI
  server job is the one that would have caught numpy; it runs on the PR, watch
  it. `LOUPE_MAX_CONCURRENT_TEMPO` is env-tunable but undocumented anywhere
  outside `server/README.md` (fine — same as the separation var).
