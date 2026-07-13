# Modal cold-start spike — structure (SongFormer)

Measures the one unknown of the GPU-offload plan
([docs/structure-modal-offload-plan.md](../docs/structure-modal-offload-plan.md)):
**with the weights baked into the image, how long is a cold start on an L4, and
how fast is a warm inference?** That number decides whether we need memory
snapshots and how to handle tempo-auto-on-import.

This is a **spike**, not the production endpoint: no auth, no HTTP, no Supabase.
It calls the existing `app.structure._analyse` verbatim (one code path) and times
it. File: [`modal_structure_spike.py`](modal_structure_spike.py).

## Prerequisites

```sh
cd server
.venv/bin/pip install modal      # already in .venv (1.5.x)
.venv/bin/modal token new        # one-time browser auth (~/.modal.toml)
```

## Run

```sh
cd server
.venv/bin/modal run modal_structure_spike.py
```

- **First run** builds the image: installs the torch + SSL stack and downloads
  ~1.5 GB of weights ONCE into the image layer (SongFormer 99 MB + MusicFM
  1.23 GB + stats + the MuQ snapshot). Slow, one-time. Cost = build compute +
  a few L4-seconds (cents, within the $30/mo free credit).
- **Later runs** reuse the cached image and just re-run the timing.

## Results (L4, weights baked) — 2026-07-13

| Variant | COLD wall | WARM wall | Note |
|---|---|---|---|
| **v1** naive (baked weights) | **61.7 s** | 0.5 s | load 31.6 + first-infer 23.8 |
| **v2a** + warmup in `enter()` | ~50 s | 0.5 s | request infer → **0.5 s** (autotune moved to boot) |
| **v2b** + CPU memory snapshot | **54.7 s** | 0.9 s | restore ~34 s — **no win**, rejected |

- **Warm is excellent (0.5 s)** and stays so with the warmup (`scaledown_window`
  keeps a session's container warm).
- **The warmup works**: a dummy forward in `@modal.enter()` absorbs the ~24 s
  CUDA/cuDNN autotune, so the real request's `infer` is ~0.5 s cold AND warm.
- **CPU memory snapshots do NOT help here** and were rejected. The snapshotted
  state is multi-GB of weights in RAM; restoring that image (~34 s) is as slow as
  reloading from the baked files. Snapshots win when imports/JIT dominate (small
  state), not when GBs of weights do. Measured via `modal deploy` + a client
  invoking a restored container (`modal run` can't snapshot — ephemeral apps).
- Bake worked (5 files fetched at build, never on the cold path). Pipeline
  verified end-to-end (`segments=1` on the synthetic probe).

**The ~50 s cold floor** (load + move-to-GPU + autotune) does not fall further
without **GPU memory snapshots (alpha)** — the only lever that captures the warmed
GPU state — or a paid always-warm container (`min_containers=1` ≈ $575/mo L4 idle,
too much for beta).

**Decisions this fed:**
1. **Tempo auto-on-import must NOT hit a cold Modal call** (~50 s before the grid
   is unacceptable) — keep tempo instant (local/WASM) or make analysis explicit.
2. **Sync stays viable** (~50 s fits a generous HTTP timeout).
3. **Product mitigation = warm-on-import prefetch**: fire a background warmup to
   Modal when a track loads, so the container is hot by the time the user clicks
   an on-demand analysis. Hide the cold start behind think-time rather than fight
   it. See `docs/structure-modal-offload-plan.md` §5.

## Read the output

```
=== structure cold-start spike (L4, weights baked) ===
COLD  wall= …s  load= …s  infer= …s  segments=…
WARM  wall= …s  infer= …s  segments=…
```

- `COLD wall` ≈ container boot + model load (`load`) + first inference (`infer`).
- `WARM wall` ≈ inference only (same container, model already resident).
- If **`load` dominates** and the cold wall is painful (say > ~20 s), turn on the
  next lever (below). If it's already acceptable, we skip snapshots.

## Decisions this feeds

- **Sync vs async** — if worst-case cold+infer fits a generous HTTP timeout, keep
  the current synchronous adapter (AbortSignal already threaded).
- **Tempo auto-import** — the cold number tells us whether every import can afford
  a Modal round-trip, or whether tempo needs to stay instant (local/WASM).

## Tried and rejected — CPU memory snapshots

`enable_memory_snapshot=True` with a CPU-load-under-`snap=True` /
GPU-move-under-`snap=False` split (needs `modal deploy`, not `modal run`). The
restore of the multi-GB weight state took ~34 s → no win (see the table above).
Kept out of the recommended shape.

## The one remaining lever — GPU memory snapshots (alpha)

The only thing that would cut the ~50 s cold materially: capture the *warmed GPU*
state so a restored container skips load + move + autotune. It's alpha; try it if
the warm-on-import mitigation proves insufficient in practice.

## Cleanup

The spike app is `loupe-structure-spike` on Modal. Nothing runs when idle
(`min_containers=0`). Remove it entirely with:

    .venv/bin/modal app stop loupe-structure-spike

## Assumptions verified on first successful run

- `requirements.txt` installs a CUDA torch wheel on Linux (PyPI default).
- The vendored `app/songformer` + `configs/SongFormer.yaml` resolve at `/root/app`.
- `decode_wav_mono` accepts a standard PCM16 mono WAV (the synthetic probe).
