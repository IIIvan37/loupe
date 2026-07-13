"""Modal cold-start spike for the structure (SongFormer) endpoint.

Goal of THIS file: answer one question with real numbers — **with the weights
baked into the image, how long is a cold start on an L4, and how fast is a warm
inference?** That number decides whether we need memory snapshots (§5 of
`docs/structure-modal-offload-plan.md`) and how to handle tempo-auto-on-import.

It is deliberately NOT the production endpoint: no auth, no ASGI/HTTP, no
Supabase. It calls the existing `app.structure._analyse` directly and times it.
The server code is reused verbatim (one code path, local in dev / Modal in prod).

Run it (from the `server/` directory, with a Modal account):

    pip install modal
    modal token new            # one-time browser auth
    modal run modal_structure_spike.py

First run builds the image (installs torch+SSL stack, downloads ~1.5 GB of
weights ONCE into the image) — slow, one-time. Subsequent runs reuse the image.
The script then times a COLD call (fresh container: boot + model load + infer)
and a WARM call (same container: infer only), and prints the breakdown.

Assumptions to verify on first run (I could not execute Modal here):
  - `requirements.txt` installs a CUDA torch wheel on Linux (PyPI default). ✓ expected.
  - The vendored `app/songformer` + `configs/SongFormer.yaml` resolve once `app/`
    is mounted at `/root/app`.
  - `decode_wav_mono` accepts a standard PCM16 mono WAV (the synthetic probe).
"""

from __future__ import annotations

import time

import modal

# --- Image -----------------------------------------------------------------
# Full requirements.txt (not a trimmed subset): correctness-first for a spike we
# can't iterate on locally — it's exactly the set the local server runs. Trim to
# the structure-only deps later to shrink the image / speed imports.
CACHE_DIR = "/cache"


def _bake_weights() -> None:
    """Download the pinned checkpoints + the MuQ snapshot into the image.

    Runs at BUILD time (CPU, no GPU): only downloads bytes, never loads a model
    onto a device. Reuses the app's own pins so this can't drift from runtime.
    """
    from huggingface_hub import snapshot_download

    from app import structure  # noqa: PLC0415 (build-time import)

    structure.pinned_weights(
        structure._SONGFORMER_URL,
        structure._SONGFORMER_SHA256,
        structure._CACHE_DIR / "SongFormer.safetensors",
    )
    structure.pinned_weights(
        structure._MUSICFM_URL,
        structure._MUSICFM_SHA256,
        structure._CACHE_DIR / "pretrained_msd.pt",
    )
    structure.pinned_weights(
        structure._MUSICFM_STATS_URL,
        structure._MUSICFM_STATS_SHA256,
        structure._CACHE_DIR / "msd_stats.json",
    )
    # MuQ is fetched by MuQ.from_pretrained at runtime; pre-populate the HF cache
    # (same repo + revision) so that fetch is a local cache hit, not a download.
    snapshot_download(
        repo_id=structure._MUQ_NAME,
        revision=structure._MUQ_REVISION,
    )


image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")  # soundfile/librosa audio backends
    .pip_install_from_requirements("requirements.txt")
    .env(
        {
            # The app reads weights from XDG_CACHE_HOME/loupe/songformer; point it
            # at an in-image path so the bake step below persists into the layer.
            "XDG_CACHE_HOME": CACHE_DIR,
            "HF_HOME": f"{CACHE_DIR}/hf",  # MuQ snapshot lands here
            # `import app` must resolve at build (bake) and runtime (enter).
            "PYTHONPATH": "/root",
            # On a Modal GPU container torch sees cuda; be explicit anyway.
            "LOUPE_STRUCTURE_DEVICE": "cuda",
        }
    )
    # The server package (routers + vendored SongFormer/MuQ/MusicFM). copy=True so
    # the weight-bake run_function below can import it at build time.
    .add_local_dir("app", "/root/app", copy=True)
    # Bake the weights into the image so they are NEVER on the cold path.
    .run_function(_bake_weights)
)

app = modal.App("loupe-structure-spike")


# --- The GPU worker --------------------------------------------------------
# enable_memory_snapshot is OFF for this first measurement: we want the NAIVE
# baked-weights cold start (the honest baseline). If it's too slow, the next
# spike turns it on and loads in @modal.enter(snap=True) — see the runbook.
@app.cls(
    image=image,
    gpu="L4",
    timeout=900,
    scaledown_window=120,
    # enable_memory_snapshot=True,  # <- v2 lever, see MODAL_SPIKE.md
)
class Structure:
    @modal.enter()
    def load(self) -> None:
        """Cold-path cost: import the SSL stack + load the three models to GPU."""
        started = time.perf_counter()
        from app import structure  # noqa: PLC0415

        structure._load()  # loads SongFormer + MusicFM + MuQ onto cuda
        self.load_seconds = time.perf_counter() - started

    @modal.method()
    def analyse(self, wav_bytes: bytes) -> dict:
        """Run one structure analysis, returning timings + a segment count."""
        from app import structure  # noqa: PLC0415

        started = time.perf_counter()
        result = structure._analyse(wav_bytes)
        return {
            "load_seconds": getattr(self, "load_seconds", None),
            "infer_seconds": time.perf_counter() - started,
            "segments": len(result["segments"]),
        }


def _probe_wav(seconds: int = 30, sample_rate: int = 16_000) -> bytes:
    """A synthetic PCM16 mono WAV — content is irrelevant, we time the pipeline.

    Stdlib only (no numpy), so it runs on the caller's machine without the ML env.
    """
    import array
    import io
    import math
    import wave

    samples = array.array(
        "h",
        (
            int(12_000 * math.sin(2 * math.pi * 220 * i / sample_rate))
            for i in range(seconds * sample_rate)
        ),
    )
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(samples.tobytes())
    return buffer.getvalue()


@app.local_entrypoint()
def main() -> None:
    """Time a COLD call (fresh container) then a WARM call (reused container)."""
    wav = _probe_wav()
    worker = Structure()

    cold_wall = time.perf_counter()
    cold = worker.analyse.remote(wav)
    cold_wall = time.perf_counter() - cold_wall

    warm_wall = time.perf_counter()
    warm = worker.analyse.remote(wav)
    warm_wall = time.perf_counter() - warm_wall

    print("\n=== structure cold-start spike (L4, weights baked) ===")
    print(f"COLD  wall={cold_wall:6.1f}s  load={cold['load_seconds']:6.1f}s  "
          f"infer={cold['infer_seconds']:6.1f}s  segments={cold['segments']}")
    print(f"WARM  wall={warm_wall:6.1f}s  "
          f"infer={warm['infer_seconds']:6.1f}s  segments={warm['segments']}")
    print("\nRead: COLD wall ≈ container boot + model load + infer; WARM wall ≈ "
          "infer only. If COLD load dominates and hurts, enable memory snapshots "
          "(see MODAL_SPIKE.md).")
