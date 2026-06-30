# Session — 2026-06-30 — remove-wasm-separators

## Done
- **Removed the superseded in-browser WASM separators.** The HTTP separator
  (FastAPI + Demucs, PR #19, merged) is now the only engine. Deleted in `web`:
  the GGML and ONNX adapters (`demucs-ggml-separator`, `demucs-separator`), their
  model loaders + workers (`demucs-ggml-model`, `demucs-model`,
  `demucs-ggml-worker`, `demucs-worker`), the orchestrators
  (`worker-separator`, `parallel-worker-separator`), and the WASM-only helpers
  (`model-cache`, `resample`, `stem-layout`, `audio-format`).
- **Dropped the vendored assets + build tooling**: `public/demucs/` (640 KB
  GGML wasm) and `public/ort/` (ONNX runtime), the `copy-ort.mjs` /
  `build-demucs.sh` scripts and their `predev`/`prebuild` hooks, and the
  `onnxruntime-web` dependency.
- **`create-separator.ts` collapsed** to a single no-arg factory returning the
  HTTP engine (`SeparatorEngine` union gone); `useSeparation` already called it
  with no argument.
- **Removed the now-dead core DSP** that only the WASM workers used:
  `domain/segment-plan.ts` (`planSegments` / `planChunks` / `transitionWindow`)
  and `domain/overlap-add.ts` (`overlapAdd` / `WindowedPiece`), plus their
  `index.ts` exports and colocated specs. `encodeWav` / `decodeWav` stay — the
  HTTP adapter uses both.
- **Docs realigned** (earlier in the session, on `main`): the root README,
  `application/README.md` registry, and `separator-server/README.md` now match
  the HTTP-only reality. This branch updates the `StemSeparator` registry row to
  drop the "slated for removal" wording.
- Net **−1598 lines** across 25 files.

## Not done / remaining
- In-app per-stem playback (multitrack) is still pending — the WAV-download
  button remains the only way to hear a stem.
- Slice **J2.3** (instrument detection → N adaptive tracks) not started.

## Decisions
- **The in-browser WASM separation path is permanently retired** — server-side
  Demucs is the single supported engine. The `StemSeparator` port is unchanged,
  so a future cloud/native adapter can still slot in. (Resolves the "WASM engines
  remain as fallbacks for now" open item from the 2026-06-30 server-side report.)

## Gate status
- typecheck: ✅
- tests (with coverage): ✅ (vitest green)
- mutation (Stryker, local, core touched): ✅ **95.37%** (≥ 80 break threshold;
  removing `segment-plan` / `overlap-add` left the remaining core well-covered)
- biome / sheriff / knip / jscpd: ✅ (`pnpm gate` EXIT 0; knip confirms no dead
  code after the deletions; jscpd clones unchanged, all pre-existing CSS).

## State to resume from
- **Single next action**: open the PR for this branch
  (`chore/remove-wasm-separators`), merge, then resume **Slice J2.3** (adaptive
  instrument detection) or implement **in-app per-stem playback** (multitrack
  mixer, Web Audio gain graph — roadmap J2.4).
- Gotchas / half-done edits: none. Working tree clean after the report commit.
  Running the app now requires the separator-server up (`uvicorn app.main:app
  --port 8000`) — there is no in-browser fallback anymore.
