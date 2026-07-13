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

## Results (v1 — naive, weights baked, L4) — 2026-07-13

```
COLD  wall= 61.7s   (boot ~6s + load 31.6s + first-infer 23.8s)
WARM  wall=  0.9s   (infer 0.5s)
```

- **Warm is excellent (0.5 s).** With `scaledown_window=120s` a session pays the
  cold price only once.
- **Cold ~62 s**, split into: `load 31.6s` (SSL imports + ~2 GB weights → GPU,
  the snapshot target) and `first-infer 23.8s` (CUDA/cuDNN autotune on the first
  forward — NOT real inference; a warmup in `@modal.enter()` absorbs it).
- Bake worked (5 files fetched at build, never on the cold path). Pipeline
  verified end-to-end (`segments=1` on the synthetic probe).

**Decisions this fed:**
1. **Tempo auto-on-import must NOT hit a cold Modal call** (62 s before the grid
   is unacceptable) — keep tempo instant (local/WASM) or make analysis explicit.
   On-demand tasks (structure/chords/separation) can afford a one-off "Analysing…".
2. **Sync stays viable** (62 s fits a generous HTTP timeout) once cold is reduced.

**Next: v2** — memory snapshots + enter-warmup, target ~15-20 s cold / 0.5 s warm.

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

## Next lever — memory snapshots (v2)

If the naive cold start is too slow, in `modal_structure_spike.py`:

1. Add `enable_memory_snapshot=True` to the `@app.cls(...)` decorator.
2. Split the load: import + load weights to **CPU** in `@modal.enter(snap=True)`
   (captured in the CPU snapshot), then move the models to **cuda** in a second
   `@modal.enter(snap=False)` (GPU only attaches after restore).
   - This needs `inference.Models` to expose a `.to(device)`; if not, load on CPU
     under snapshot and re-`.to("cuda")` each sub-model post-restore.
3. Re-run and compare the cold `load` seconds.

GPU memory snapshots (capture the vRAM, weights included) are alpha — try only if
CPU snapshots aren't enough.

## Cleanup

The spike app is `loupe-structure-spike` on Modal. Nothing runs when idle
(`min_containers=0`). To remove it entirely: `modal app stop loupe-structure-spike`.

## Assumptions verified on first successful run

- `requirements.txt` installs a CUDA torch wheel on Linux (PyPI default).
- The vendored `app/songformer` + `configs/SongFormer.yaml` resolve at `/root/app`.
- `decode_wav_mono` accepts a standard PCM16 mono WAV (the synthetic probe).
