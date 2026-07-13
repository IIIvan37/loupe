"""Deployed Modal endpoint for loupe's GPU inference — J1: structure only.

The production counterpart of `modal_structure_spike.py`: an HTTP endpoint that
mounts ONLY the structure router (the lazy-router pattern of `app.main`), gated
by a static bearer token (J1 MVP — replaced by Supabase-minted tokens at J2).

Contract (unchanged — the web adapter already speaks it):

    POST /structure   Authorization: Bearer <token>   body = mix WAV
      -> 200 {"segments": [{"start","end","label"}, ...]}
    POST /warmup      Authorization: Bearer <token>
      -> 200 {"ok": true}   (its value is the SIDE EFFECT: spinning up a warm
         container, so a later /structure is hot — the warm-on-import prefetch)

Only stateless inference runs here. Project/audio storage and yt-dlp download
stay LOCAL (rights): they are NOT part of this app.

Deploy:  cd server && .venv/bin/modal deploy modal_app.py
Needs a Modal secret `loupe-modal-token` holding LOUPE_MODAL_TOKEN (see
MODAL_SPIKE.md / the J1 runbook).
"""

from __future__ import annotations

import os

import modal

CACHE_DIR = "/cache"

# Origins allowed to call the endpoint from a browser (CORS). Dev app is on
# 5173; add the deployed/Tauri origins here later.
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def _bake_weights() -> None:
    """Download the pinned checkpoints + the MuQ snapshot into the image (build)."""
    from huggingface_hub import snapshot_download

    from app import structure  # noqa: PLC0415

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


image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
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
    secrets=[modal.Secret.from_name("loupe-modal-token")],
)
class Api:
    @modal.enter()
    def load(self) -> None:
        """Load the models to GPU and warm the kernels, off the request path."""
        from app import structure  # noqa: PLC0415

        structure._load()
        structure._analyse(_probe_wav())  # absorb the CUDA autotune

    @modal.asgi_app()
    def web(self):
        """The FastAPI surface: auth + CORS + the structure router + /warmup."""
        from fastapi import FastAPI, Request
        from fastapi.middleware.cors import CORSMiddleware
        from fastapi.responses import JSONResponse

        from app.structure import router as structure_router

        token = os.environ["LOUPE_MODAL_TOKEN"]
        web_app = FastAPI()
        web_app.add_middleware(
            CORSMiddleware,
            allow_origins=ALLOWED_ORIGINS,
            allow_methods=["POST", "OPTIONS"],
            allow_headers=["*"],
        )

        @web_app.middleware("http")
        async def require_token(request: Request, call_next):
            # CORS preflight carries no Authorization — let it through to the
            # CORS middleware, which answers it.
            if request.method == "OPTIONS":
                return await call_next(request)
            header = request.headers.get("authorization", "")
            if header != f"Bearer {token}":
                return JSONResponse({"detail": "unauthorized"}, status_code=401)
            return await call_next(request)

        @web_app.post("/warmup")
        def warmup() -> dict:
            # The container is already warm by the time this returns (@enter ran).
            return {"ok": True}

        web_app.include_router(structure_router)
        return web_app
