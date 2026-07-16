"""Modal cost spike for stem separation (htdemucs_6s) — M1.2.

Goal of THIS file: answer one question with real numbers — **what does one
htdemucs_6s separation of a 3-4 min track cost on an L4?** Wall time (cold and
warm), peak VRAM (does the L4 hold it), and seconds-of-GPU per second-of-audio.
Those numbers feed the M1.2 product decision (weighted units vs separate quota
vs spend cap) in `docs/client-leger-plan.md`.

It is deliberately NOT the production endpoint: no auth, no HTTP, no NDJSON
streaming (that is M1.3). The test mix is synthetic noise generated IN the
container — demucs' wall time depends on duration, not content, and this keeps
the upload out of the measurement (transport is a separate M1.3 arbitrage).

Run it (from the `server/` directory):

    .venv/bin/modal run modal_separation_spike.py

The image mirrors `modal_app.py`'s layer chain (same apt + requirements + env)
so the multi-GB torch layer is a cache hit; only the weight bake differs.
"""

from __future__ import annotations

import time

import modal

CACHE_DIR = "/cache"
MODEL_NAME = "htdemucs_6s"
TRACK_SECONDS = 210  # a 3.5-min track, the plan's "piste de 3-4 min"
SAMPLE_RATE = 44100


def _bake_weights() -> None:
    """Download the htdemucs_6s checkpoints into the image (build time, CPU)."""
    from demucs.pretrained import get_model

    get_model(MODEL_NAME)  # torch.hub cache lands under XDG_CACHE_HOME/torch


image = (
    modal.Image.debian_slim(python_version="3.11")
    # Same chain as modal_app.py so the pip layer is a cache hit.
    .apt_install("ffmpeg", "git")
    .pip_install_from_requirements("requirements.txt")
    .env(
        {
            "XDG_CACHE_HOME": CACHE_DIR,
            "HF_HOME": f"{CACHE_DIR}/hf",
            "PYTHONPATH": "/root",
        }
    )
    .run_function(_bake_weights)
)

app = modal.App("loupe-separation-spike")


@app.cls(
    image=image,
    gpu="L4",
    timeout=1800,
    scaledown_window=60,  # a spike: no reason to keep the container warm long
)
class Separator:
    @modal.enter()
    def load(self) -> None:
        """Cold path: load the model to GPU and absorb the CUDA autotune."""
        import torch
        from demucs.apply import apply_model
        from demucs.pretrained import get_model

        started = time.perf_counter()
        self.model = get_model(MODEL_NAME)
        self.model.to("cuda")
        self.model.eval()
        self.load_seconds = time.perf_counter() - started

        started = time.perf_counter()
        probe = torch.rand(2, SAMPLE_RATE * 8) * 0.1 - 0.05
        with torch.no_grad():
            apply_model(self.model, probe[None], device="cuda")
        self.warmup_seconds = time.perf_counter() - started

    @modal.method()
    def separate(self, seconds: int) -> dict:
        """One separation, same call shape as app/separation.py's inference."""
        import torch
        from demucs.apply import apply_model

        mix = torch.rand(2, SAMPLE_RATE * seconds) * 0.5 - 0.25
        torch.cuda.reset_peak_memory_stats()
        started = time.perf_counter()
        with torch.no_grad():
            stems = apply_model(self.model, mix[None], device="cuda", progress=True)[0]
        infer_seconds = time.perf_counter() - started
        return {
            "load_seconds": self.load_seconds,
            "warmup_seconds": self.warmup_seconds,
            "infer_seconds": infer_seconds,
            "stems": len(stems),
            "peak_vram_gb": torch.cuda.max_memory_allocated() / 1024**3,
            "gpu_seconds_per_audio_second": infer_seconds / seconds,
        }


@app.local_entrypoint()
def main() -> None:
    """Time a COLD call (fresh container) then a WARM call (reused container)."""
    worker = Separator()

    cold_wall = time.perf_counter()
    cold = worker.separate.remote(TRACK_SECONDS)
    cold_wall = time.perf_counter() - cold_wall

    warm_wall = time.perf_counter()
    warm = worker.separate.remote(TRACK_SECONDS)
    warm_wall = time.perf_counter() - warm_wall

    print(f"\n=== separation cost spike ({MODEL_NAME}, L4, {TRACK_SECONDS}s track) ===")
    print(
        f"COLD  wall={cold_wall:6.1f}s  load={cold['load_seconds']:5.1f}s  "
        f"warmup={cold['warmup_seconds']:5.1f}s  infer={cold['infer_seconds']:6.1f}s"
    )
    print(f"WARM  wall={warm_wall:6.1f}s  infer={warm['infer_seconds']:6.1f}s")
    print(
        f"stems={warm['stems']}  peak VRAM={warm['peak_vram_gb']:.2f} GB  "
        f"ratio={warm['gpu_seconds_per_audio_second']:.3f} GPU-s per audio-s"
    )
    print(
        "\nRead: billed container time per separation ≈ WARM infer (plus the "
        "one-off load+warmup and the scaledown window, amortised per session). "
        "Multiply by the L4 $/s from modal.com/pricing for the M1.2 decision."
    )
