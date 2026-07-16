"""Deployed Modal endpoint for loupe's GPU inference — the three detections.

The production counterpart of `modal_structure_spike.py`: an HTTP endpoint that
mounts the structure, tempo and chords routers (the lazy-router pattern of
`app.main`), gated by a SHORT-LIVED bearer token the Supabase Edge Function
mints per analysis (J2). The endpoint verifies it with the shared HS256 secret
and never holds a long-lived credential. One app, one container: the three
models fit together and share the warm (M1.1 — the local server V.3 already
loads them side by side).

Contract (unchanged — the web adapters already speak it):

    POST /structure   Authorization: Bearer <token>   body = mix WAV
      -> 200 {"segments": [{"start","end","label"}, ...]}
    POST /tempo       Authorization: Bearer <token>   body = mix WAV
      -> 200 {"bpm": float, "beats": [{"time","position"}, ...]}
    POST /chords      Authorization: Bearer <token>   body = mix WAV
      -> 200 {"chords": [{"start","end","label"}, ...]}
    POST /warmup      Authorization: Bearer <token>
      -> 200 {"ok": true}   (its value is the SIDE EFFECT: spinning up a warm
         container, so a later analysis is hot — the warm-on-import prefetch)

Only stateless inference runs here. Project/audio storage and yt-dlp download
stay LOCAL (rights): they are NOT part of this app. Separation follows in
M1.3, after the quota model is re-weighed (M1.2).

Deploy:  cd server && .venv/bin/modal deploy modal_app.py
Needs a Modal secret `loupe-analyze-jwt` holding ANALYZE_JWT_SECRET, the SAME
value set as the Supabase Edge Function secret (see the J2 runbook).
"""

from __future__ import annotations

import os

import modal

CACHE_DIR = "/cache"


def _bake_weights() -> None:
    """Download the pinned checkpoints + the MuQ snapshot into the image (build)."""
    from huggingface_hub import snapshot_download

    from app import chords, structure, tempo  # noqa: PLC0415

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
    snapshot_download(
        repo_id=structure._MUQ_NAME,
        revision=structure._MUQ_REVISION,
    )
    # M1.1: tempo (beat_this) + chords (BTC) ride along — each resolves its own
    # sha256-pinned checkpoint into the image cache (XDG_CACHE_HOME=/cache).
    tempo._checkpoint_path()
    chords._weights_path()


image = (
    modal.Image.debian_slim(python_version="3.11")
    # git: requirements.txt pins madmom to a commit via git+https.
    .apt_install("ffmpeg", "git")
    .pip_install_from_requirements("requirements.txt")
    .env(
        {
            "XDG_CACHE_HOME": CACHE_DIR,
            "HF_HOME": f"{CACHE_DIR}/hf",
            "PYTHONPATH": "/root",
            "LOUPE_STRUCTURE_DEVICE": "cuda",
        }
    )
    .add_local_dir("app", "/root/app", copy=True)
    .run_function(_bake_weights)
)

app = modal.App("loupe-structure")


def _probe_wav(seconds: int = 8, sample_rate: int = 16_000) -> bytes:
    """A synthetic PCM16 mono WAV to warm the CUDA kernels (content irrelevant)."""
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


@app.cls(
    image=image,
    gpu="L4",
    timeout=900,
    scaledown_window=300,  # keep the container warm across a user's session
    secrets=[modal.Secret.from_name("loupe-analyze-jwt")],
)
class Api:
    @modal.enter()
    def load(self) -> None:
        """Load the models and warm the kernels, off the request path."""
        from app import chords, structure, tempo  # noqa: PLC0415
        from app.analyze_gate import assert_strong_secret

        # Fail fast on a weak secret — before minutes of billed model loading.
        assert_strong_secret(os.environ.get("ANALYZE_JWT_SECRET", ""))

        probe = _probe_wav()
        structure._load()
        structure._analyse(probe)  # absorb the CUDA autotune
        # M1.1: the probe runs through tempo (cuda) and chords (cpu) too, so
        # every first request of a session is inference-only.
        tempo._analyse(probe)
        chords._analyse(probe)

    @modal.asgi_app()
    def web(self):
        """The FastAPI surface: auth + CORS + the analysis routers + /warmup."""
        from fastapi import FastAPI
        from fastapi.middleware.cors import CORSMiddleware

        from app.analyze_gate import install_analyze_gate
        from app.chords import router as chords_router
        from app.origins import allowed_origins
        from app.structure import router as structure_router
        from app.tempo import router as tempo_router

        # J2: the client presents a SHORT-LIVED token minted by the Supabase
        # Edge Function, signed HS256 with this shared secret. The static J1
        # token is gone — no long-lived credential ships in the app.
        secret = os.environ["ANALYZE_JWT_SECRET"]
        web_app = FastAPI()
        # Gate FIRST, CORS after: add_middleware prepends, so CORS wraps the
        # gate — its 401s get Access-Control-Allow-Origin from the real CORS
        # layer and preflights never reach the gate (see app/analyze_gate.py).
        install_analyze_gate(web_app, secret=secret)
        # Origins come from LOUPE_ALLOWED_ORIGINS (set it on the
        # `loupe-analyze-jwt` Modal secret to add deployed/Tauri origins);
        # unset, the shared default is the 5173 dev app.
        web_app.add_middleware(
            CORSMiddleware,
            allow_origins=allowed_origins(),
            allow_methods=["POST", "OPTIONS"],
            allow_headers=["*"],
        )

        @web_app.post("/warmup")
        def warmup() -> dict:
            # The container is already warm by the time this returns (@enter ran).
            return {"ok": True}

        web_app.include_router(structure_router)
        web_app.include_router(tempo_router)
        web_app.include_router(chords_router)
        return web_app
