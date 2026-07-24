# Session — 2026-06-30 — jalon2-server-side-separation

## Done

- **New separation path: a local server, behind the existing `StemSeparator` port.**
  The in-browser WASM engines (GGML/ONNX) hit a quality/speed ceiling; server-side
  PyTorch does not. The core never learns separation moved off-device — the port
  already anticipated this ("a stub now, a Demucs WASM worker next, a cloud API
  later").
- **Core (pure, TDD): `decodeWav`** ([wav-decoder.ts](../../packages/core/src/domain/wav-decoder.ts)) —
  the inverse of `encodeWav`, 16-bit PCM bytes → channels. Returns a domain-local
  `DecodedWav` (not the application's `DecodedAudio`) to keep `domain → application`
  clean (Sheriff caught the first attempt). Exported from `@app/core`.
- **Web adapter (TDD): `createHttpSeparator`** ([http-separator.ts](../../packages/web/src/audio/http-separator.ts)) —
  encodes the mix as a WAV, POSTs it, parses a streamed **NDJSON** response
  (`progress` → `onProgress`, `done` → fetch + `decodeWav` each stem URL, `error` →
  throw). 6 specs against a mocked `fetch`. Wired as the **new default engine**
  `'http'` in [create-separator.ts](../../packages/web/src/audio/create-separator.ts);
  URL via `VITE_SEPARATOR_URL` (default `http://localhost:8000`). GGML/ONNX kept as
  fallbacks.
- **Backend (outside the hexagon): [separator-server/](../../separator-server/)** —
  FastAPI + Demucs (`htdemucs` default, `htdemucs_ft` via `DEMUCS_MODEL`), GPU
  auto-selected (CUDA → **MPS** → CPU). WAV decode/encode via stdlib `wave`+numpy
  (torchaudio 2.11 dropped its built-in audio backend). Stems re-ordered to the
  musician-friendly `stem-layout` order (voix/batterie/basse/autres) so switching
  engines never reshuffles the UI.
- **Genuine streamed progress.** Demucs 4's `apply_model` has no fraction callback,
  so we intercept its internal per-segment **tqdm** bar (thread-local sink → NDJSON
  `separating` fractions), running inference on a worker thread so progress streams
  live. Verified: an 18 s clip yields `[0.0, 0.25, 0.5, 0.75, 1.0]`.
- **Browser-verified end-to-end**: a real ~4-min track separated in ~38 s on the
  Apple M5 GPU (MPS); 4 stems played back; progress bar now advances.
- **Gate plumbing for the Python sibling**: `.venv` excluded from biome
  (`!separator-server`), knip (`ignore`), and git (`separator-server/.gitignore`);
  jscpd already scoped to `packages/`.

## Not done / remaining

- **Cleanup of the in-browser WASM engines** (GGML/ONNX adapters, workers,
  `model-cache`, `resample`, and the now-unused chunk/overlap-add DSP) — the "backend
  required" decision authorises removing this debt, but in a **separate PR** to keep
  this diff focused.
- `htdemucs_ft` (best quality) not yet exercised end-to-end — only `htdemucs`.
- Server is single-user/localhost: no auth, no job TTL/cleanup (stems live under the
  temp dir until the process exits). Fine for local use; harden before any shared
  deployment.
- `requirements.txt` still lists `torchaudio` explicitly (only the rare resample
  path uses it; demucs pulls it anyway) — could be trimmed.

## Decisions

- **Separation runs server-side now; the backend is required** (no automatic WASM
  fallback). Chosen with the user: quality **and** speed both come from the server,
  and "everything in the browser / zero-install" is dropped for separation.
- **The server is deliberately outside the pnpm monorepo / hexagon.** The web app
  talks to it only through the HTTP contract, so it could be reimplemented in any
  language without the web side noticing. Language choice (Python) is for the model
  ecosystem, not perf — inference cost is identical across bindings; the real perf
  levers are GPU + ONNX/TensorRT.
- **HTTP contract** (frozen, see [separator-server/README.md](../../separator-server/README.md)):
  `POST /separate` (WAV body) → streamed NDJSON; `GET /stems/{job}/{stem}.wav`.

## Gate status

- typecheck: ✅
- tests (with coverage): ✅ 234 passing; new code covered (`http-separator` ~92%)
- mutation (Stryker, local, core touched): ✅ **95.66%** overall; `wav-decoder.ts`
  **96.67%** (lifted from 73.33% by targeted tests for the too-short guard, the
  zero-channels guard, the RIFF||WAVE check, and exact ±1 scaling; the 2 remaining
  survivors are equivalent mutants — `<`/`<=` at sample 0 both yield 0)
- biome / sheriff / knip / jscpd: ✅ (after excluding `separator-server` from biome
  + knip)

## State to resume from

- **Single next action**: open the PR for branch `feat/http-separator` (this report
  + STATUS update ship inside it), then merge.
- Gotchas / half-done edits:
  - To run the server: `cd separator-server && python -m venv .venv && .venv/bin/pip
    install -r requirements.txt && .venv/bin/uvicorn app.main:app --port 8000`; point
    the web app with `VITE_SEPARATOR_URL=http://localhost:8000 pnpm --filter @app/web dev`.
  - Python 3.14 / arm64: torch 2.12.1 wheels exist; MPS is used (no CUDA on Mac).
  - The WASM-cleanup PR is the natural follow-up after this merges.
