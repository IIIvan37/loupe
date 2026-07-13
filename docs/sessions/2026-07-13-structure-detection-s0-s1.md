# Session — 2026-07-13 — structure-detection S.0 spike + S.1 server

Phase 2 of the lead-sheet lot: deduce song structure from **audio** (the P.4
MDL deduction disappointed). Plan: [structure-detection-plan.md](../structure-detection-plan.md).

## Done

- **S.0 — engine spike (verdict: GO for SongFormer + chunking).** Throwaway
  venv (Python 3.11); SongFormer + MuQ + MusicFM stood up, patched for MPS.
  - **Runs on the Mac GPU (MPS)**, torch 2.12 (pin 2.4 relaxed). Quality on
    two real tracks (Logical Song, Queen) clearly beats the MDL — intro/verse/
    chorus/bridge/inst/outro with musically-right boundaries.
  - **Memory was the one wall:** the reference full-window inference peaks
    ~16 GB and swaps on this 16 GB Mac for tracks > ~4.5 min. **Chunking (180 s
    owned windows + 20 s context margins) fixes it** — RAM ~0.2 GB, RTF ~0.17×,
    seam artefact ("intro" at chunk starts) killed by margin+ownership trimming
    and gap-closing. Chunking algorithm prototyped in `chunked_infer.py`.
  - **Snap measured:** beat_this downbeats vs SongFormer boundaries — median
    Δ **0.14 s** (boundaries already land on downbeats). The 3 outliers are all
    beatless zones (anacrusis, outro) → gave the S.2 snap rules (snap if
    Δ < 1 bar, first=0, last=duration, merge sub-bar).
- **S.1 — server `POST /structure` (merged into this PR).**
  - **S.1a — pure core (TDD, CI-tested torch-free like btc_windows/chord_spans):**
    `structure_chunks.chunk_plan` (owned windows + margins) and
    `structure_segments.stitch_segments` (offset → centre-ownership filter →
    same-label seam merge → interior gap-close). 16 unit tests. `/structure`
    lazy-import + 503 fallback in `main.py`, covered in `test_main_fallbacks`.
  - **S.1b — vendored torch shell:** `app/songformer/` (SongFormer inference
    closure + MuQ + MusicFM, verbatim, licences + `VENDORING.md`; `muq_mulan`/
    `msaf`/x-clip pruned, torchvision-bump avoided). `structure.py` mirrors
    `chords.py`: weights pinned (SongFormer + MusicFM sha256, MuQ-large HF
    revision), loaded once, **chunked inference**, mps/cuda/cpu, semaphore +
    wait_for + 503/504/400. Deps added to `requirements.txt` (transformers
    4.51.1 pinned); `requirements-dev.txt` stays torch-free → CI unaffected.
  - **Verified end-to-end:** `_analyse` (POST path) and the live HTTP endpoint
    both reproduce the spike's segmentation exactly (Queen 13 sections; Logical
    Song 9 sections, HTTP 200 in 64 s through the full middleware stack).
  - **Review (8-angle, verified) → 5 fixes:** stitch head/tail is the core
    snap's job (not the server); model-load failure → 503 not 400; sys.path
    appended (not index-0) to protect generic vendored names; sub-second clip
    → 400 like /chords; honest MuQ-pinning + pyproject comments.

## Not done / remaining

- **S.2 — core** (`StructureDetector` port + `detectStructure` use-case +
  boundary snap to downbeats, spec measured) — next, outside-in via the web
  adapter. Extends `deduceStructure` to accept external cut points.
- **S.3 — web** — `createHttpStructureDetector` + `useStructureDetection` +
  the separate « Détecter la structure » button (arbitrated) placing structure
  markers + feeding the chord draft.
- Weights (~2.5 GB) stay out of the repo, cached in `~/.cache/loupe/songformer`
  (pinned), like Demucs/beat_this.

## Decisions

- **SongFormer over all-in-one** (spike): clearly better labels, healthy deps.
  MuQ backbone is CC-BY-NC — accepted (non-commercial tool, htdemucs posture).
- **Chunked inference is mandatory** on 16 GB (prod target undecided → must fit
  this Mac). The chunk/stitch helpers are pure and TDD-tested.
- **Server stays "dumb":** raw-second segments; snapping to the beat grid is the
  pure core's job (it has the downbeats), mirroring /chords shipping raw spans.
- **Separate « Détecter la structure » button** (arbitrated): places markers
  even without a chord grid; « Détecter les accords » uses the sections if present.

## Gate status

- typecheck (pyright, torch-free scope) : ✅ 0 errors
- tests (torch-free, with coverage) : ✅ **180 tests**, 97.66 %
- ruff : ✅ ; vendored tree + torch shells excluded from ruff/pyright/coverage
- mutation (Stryker) : n/a — no `@app/core` change (server-only slice)
- end-to-end : ✅ live `POST /structure` reproduces the spike on real tracks

## State to resume from

- **Single next action:** open + merge the S.1 PR (branch
  `feat/structure-server-s1`, 4 commits incl. this report), then start **S.2**
  (core port + `detectStructure` + snap) in TDD, pulled outside-in.
- Gotchas:
  - Running SongFormer needs the server venv's full `requirements.txt`
    (torch + transformers 4.51.1 + …); CI/`requirements-dev.txt` stays torch-free.
  - Weights pre-seed: copy SongFormer.safetensors / pretrained_msd.pt /
    msd_stats.json into `~/.cache/loupe/songformer` to skip the 1.3 GB fetch.
  - MPS needs `PYTORCH_ENABLE_MPS_FALLBACK=1` (STFT op falls back to CPU).
  - The spike venv + `chunked_infer.py` / `measure_snap.py` live in the
    session scratchpad (throwaway) if the numbers need re-checking.
