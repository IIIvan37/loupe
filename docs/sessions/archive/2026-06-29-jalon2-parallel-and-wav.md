# Session — 2026-06-29 — jalon2-parallel-and-wav

Two related separation enhancements on `feat/jalon2-parallel-separation`, both
behind the existing pure `StemSeparator` port (no domain/UI rework):
**data-parallel GGML separation (J2.2b)** + **per-stem WAV export** (so the stems
can finally be heard).

## Done

- **Core (pure, TDD + property + mutation)**
  - `domain/overlap-add.ts` — `overlapAdd(total, pieces)`: weighted overlap-add that
    blends windowed pieces back into one buffer (a single full-cover piece → identity).
  - `domain/segment-plan.ts` — `planChunks(total, chunkCount, context)`: ≤ N
    overlapping windows for the parallel split (thin wrapper over `planSegments`).
  - `domain/wav-encoder.ts` — `encodeWav(channels, sampleRate)`: pure 16-bit PCM WAV
    bytes (clamped, interleaved); rejects unequal-length channels.
  - `application/separate-track.ts` — the ok result now also returns `sources`
    (the raw `SeparatedStem[]` PCM) so an adapter can export/play them.
- **Web — parallel separation** (`audio/parallel-worker-separator.ts`): split the
  resampled track into overlapping chunks, run each in its own GGML worker
  concurrently, blend with the core `overlapAdd`. `createGgmlSeparator` now fans out
  to `min(cores−1, 4)` workers; one chunk (short track / 1 worker) = the old
  single-worker behaviour. The existing GGML worker is reused unchanged.
- **Web — WAV export**: `useSeparation` keeps the stems' PCM in a ref and exposes
  `downloadStem(id)` → `encodeWav` → `downloadBlob` (`01_Voix.wav`…); `SeparationPanel`
  gains a per-stem « WAV ↓ » button. `audio/download-blob.ts` helper.
- **Browser-verified**: on a normal track, separation + parallel + per-stem WAV
  download all work; stems sound correct. (An earlier "empty bass / guitar-in-vocals"
  was a guitar-centric, low-bass track × htdemucs limits — not a pipeline bug.)
- **High-effort code review** (8 angles): no happy-path bug. Fixed: cap `chunkCount`
  so chunks stay adjacent (no triple-overlap on short tracks); per-chunk windows
  (removes a stride/`MODEL_STEM_COUNT` divergence hazard, derives stem count from
  the workers); swallow a post-supersede straggler rejection; `analysing` progress
  until all workers separate; defer `revokeObjectURL` (Safari/Firefox download abort);
  `encodeWav` returns `Uint8Array<ArrayBuffer>` (drops a Blob cast) + equal-length guard.

## Not done / remaining

- **In-app per-stem playback** — the user chose "download first, playback next"; this
  is the next slice (play/solo each stem via Web Audio — the start of the J2.4 mixer).
- **Speed is modest** — parallel gain was "not flagrant" (CPU memory-bandwidth bound
  + overlap overhead); deliberately not tuned this session ("optimise later"). Levers:
  the `chunkCount` cap / context size, or fewer-but-larger chunks.
- **Orchestrator consolidation (noted debt)** — `createWorkerSeparator` (single,
  used by the ONNX adapter) and `createParallelWorkerSeparator` duplicate the
  supersede/terminate lifecycle; the single case is the parallel `N=1` reduction.
  Collapsing them is a clean follow-up but touches the non-default ONNX path (can't
  browser-verify now), so deferred.
- Slices J2.3–J2.6 unchanged.

## Decisions

- **Parallelism = data-parallel multiple workers**, not wasm threads — keeps the
  single-threaded SIMD build and **no COOP/COEP**, at N× model memory (capped N≤4).
- **WAV export = 16-bit PCM** (universal for GarageBand/Logic), pure core encoder;
  stems' PCM retained in the hook's ref (off the pure domain state).

## Gate status

- typecheck: ✅
- tests (with coverage): ✅ 221 passing (core thresholds met; web adapters/workers
  verified in-browser)
- mutation (Stryker, local — core touched): ✅ **94.24%** overall
  (`overlap-add` 96.3%, `segment-plan` 96.9%, `wav-encoder` ~86%) ≥ 80 threshold
- biome / sheriff / knip / jscpd / react-doctor: ✅

## State to resume from

- **Single next action**: open the PR for this branch (parallel separation + WAV
  export), then start **in-app per-stem playback** on a fresh branch.
- Gotchas / half-done edits:
  - This branch bundles **two slices** (parallel + WAV) per the user's momentum
    request — split into separate PRs if a reviewer prefers.
  - The parallel branch was cut **before** opening the J2.2b parallel PR; this branch
    contains the J2.2b commits too (it was branched off `main` after #17 merged, then
    parallel + WAV layered on).
  - `CHUNK_CONTEXT_SAMPLES` (GGML, 343980) and `SEGMENT_SAMPLES` (ONNX) share the
    7.8 s value but mean different things (chunk context vs the model's fixed window).
