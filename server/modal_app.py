"""Deployed Modal endpoint for loupe's GPU inference — detections + separation.

The production counterpart of `modal_structure_spike.py`: an HTTP endpoint that
mounts the structure, tempo, chords and separation routers (the lazy-router
pattern of `app.main`), gated by a SHORT-LIVED bearer token the Supabase Edge
Function mints per analysis (J2). The endpoint verifies it with the shared
HS256 secret and never holds a long-lived credential. One app, one container:
the four models fit together (htdemucs_6s peaks at 0.57 GB VRAM — measured in
M1.2) and share the warm.

Contract (unchanged — the web adapters already speak it):

    POST /structure   Authorization: Bearer <token>   body = mix WAV
      -> 200 {"segments": [{"start","end","label"}, ...]}
    POST /tempo       Authorization: Bearer <token>   body = mix WAV
      -> 200 {"bpm": float, "beats": [{"time","position"}, ...]}
    POST /chords      Authorization: Bearer <token>   body = mix WAV
      -> 200 {"chords": [{"start","end","label"}, ...]}
    POST /separate    Authorization: Bearer <token>   body = mix WAV
      -> 200 application/x-ndjson (progress… then {"type":"done","stems":[…]})
    GET  /stems/{job}/{stem}.wav   Authorization: Bearer <token>
      -> 200 audio/wav             (M1.3 — the gate covers the downloads too)
    POST /warmup      Authorization: Bearer <token>
      -> 200 {"ok": true}   (its value is the SIDE EFFECT: spinning up a warm
         container, so a later analysis is hot — the warm-on-import prefetch)

Only stateless inference runs here: the separated stems live on container-local
disk just long enough for the client to download them (TTL sweep), then the
client pushes them into its LOCAL ProjectAudioStore — nothing persists here
(M1.3). Project/audio storage and yt-dlp download stay LOCAL (rights): they
are NOT part of this app.

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
    # M1.3: bake the Demucs checkpoints WITHOUT importing app.separation (its
    # import loads the model — pointless at build). DEMUCS_MODEL is pinned in
    # the image env, so bake and runtime resolve the same weights.
    from demucs.pretrained import get_model

    get_model(os.environ["DEMUCS_MODEL"])


image = (
    modal.Image.debian_slim(python_version="3.11")
    # git: requirements.txt pins madmom to a commit via git+https.
    .apt_install("ffmpeg", "git")
    .pip_install_from_requirements("requirements.txt")
    # Xet-accelerated HF downloads for the weight bake (build-time only —
    # runtime never fetches). Its own layer AFTER requirements.txt so adding
    # it never invalidates the multi-GB torch layer.
    .pip_install("hf_xet==1.5.2")
    .env(
        {
            "XDG_CACHE_HOME": CACHE_DIR,
            "HF_HOME": f"{CACHE_DIR}/hf",
            "PYTHONPATH": "/root",
            "LOUPE_STRUCTURE_DEVICE": "cuda",
            # One source of truth for the separation model: the bake step and
            # app.separation both read it (M1.3).
            "DEMUCS_MODEL": "htdemucs_6s",
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
    # Aligned on the local server's /separate wall-clock budget (M1.3): the
    # app-level LOUPE_SEPARATION_TIMEOUT_SECONDS (1800) must get to speak its
    # typed NDJSON error before Modal kills the request.
    timeout=1800,
    scaledown_window=300,  # keep the container warm across a user's session
    # ONE container, always: the stem WAVs live on container-local disk between
    # the `done` event and the client's /stems downloads, so a scale-out would
    # 404 them — and a hard cap doubles as the M1.2 beta spend guardrail.
    max_containers=1,
    secrets=[modal.Secret.from_name("loupe-analyze-jwt")],
)
@modal.concurrent(max_inputs=8)  # the six stem GETs of one run arrive together
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
        # M1.3: importing app.separation loads Demucs onto the device (cuda
        # here); a short probe absorbs its CUDA autotune like the others.
        import torch
        from demucs.apply import apply_model

        from app import separation

        with torch.no_grad():
            apply_model(
                separation.model,
                torch.zeros(2, 4 * separation.TARGET_SAMPLE_RATE)[None],
                device=separation.device,
            )

    @modal.asgi_app()
    def web(self):
        """The FastAPI surface: auth + CORS + the analysis routers + /warmup."""
        from fastapi import FastAPI
        from fastapi.middleware.cors import CORSMiddleware

        from app.analyze_gate import install_analyze_gate
        from app.chords import router as chords_router
        from app.origins import allowed_origins
        from app.separation import router as separation_router
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
        # GET serves the separated stems' WAVs (M1.3); their Authorization
        # header makes those GETs preflighted like the POSTs.
        web_app.add_middleware(
            CORSMiddleware,
            allow_origins=allowed_origins(),
            allow_methods=["GET", "POST", "OPTIONS"],
            allow_headers=["*"],
        )

        @web_app.post("/warmup")
        def warmup() -> dict:
            # The container is already warm by the time this returns (@enter ran).
            return {"ok": True}

        web_app.include_router(structure_router)
        web_app.include_router(tempo_router)
        web_app.include_router(chords_router)
        web_app.include_router(separation_router)
        return web_app
