"""Song-structure endpoint for loupe — vendored SongFormer, optional at runtime.

Implements the HTTP contract the web structure-detector adapter speaks:

    POST /structure            body = mix WAV (audio/wav)
      -> 200 application/json   {"segments": [{"start": s, "end": s,
                                              "label": "verse"}, ...]}

Labels are SongFormer's 8-class functional vocabulary (intro/verse/chorus/
bridge/inst/outro/silence/…) in raw seconds; snapping section boundaries to the
beat grid and translating labels are the pure core's job (it has the
downbeats), mirroring how /chords ships raw spans. The model is SongFormer
(ASLP-lab, WASPAA 2023, CC-BY-4.0), vendored under `app/songformer/` with its
MuQ + MusicFM SSL backbones. Its reference inference does one SSL forward over
the whole track, which OOMs unified memory past ~4.5 min (spike-measured); this
shell runs it CHUNKED (see `structure_chunks`/`structure_segments`) so peak RAM
stays bounded. `main` imports it lazily so a host without the ML stack still
serves the rest — /structure then answers 503, surfaced by the client.

Single-user, localhost — no auth.
"""

from __future__ import annotations

import asyncio
import logging
import math
import os
import sys
import threading
from pathlib import Path

import anyio.to_thread
import librosa

from .limits import (
    INFERENCE_TIMEOUT_SECONDS,
    MAX_UPLOAD_BYTES,
    concurrency_slots,
    read_capped_body,
)
from .structure_chunks import chunk_plan
from .structure_segments import Segment, stitch_segments
from .wav_decode import decode_wav_mono
from .weights_cache import WeightsUnavailable, pinned_weights

from fastapi import APIRouter, HTTPException, Request  # isort: skip

# The vendored SongFormer code (and its MuQ/MusicFM backbones) import their own
# packages top-level (`from muq import …`, `from models.SongFormer import …`),
# kept verbatim — so the vendored dir goes on the path before we import them.
_VENDOR = Path(__file__).parent / "songformer"
if str(_VENDOR) not in sys.path:
    sys.path.insert(0, str(_VENDOR))

from .songformer import inference  # noqa: E402  (needs _VENDOR on sys.path)

logger = logging.getLogger("loupe.structure")
router = APIRouter()

# SongFormer head (99 MB) + MusicFM MSD checkpoint (1.23 GB) + its stats, from
# their HF repos, fetched to the cache on first use but PINNED by sha256 — the
# checkpoints are unpickled/loaded, so we only ever load the audited artifacts.
_SONGFORMER_URL = "https://huggingface.co/ASLP-lab/SongFormer/resolve/main/SongFormer.safetensors"
_SONGFORMER_SHA256 = "87f17bfbed37014c6af4314abd9eb6971a94e3a95e9fc70f9e5ee33bdacb487b"
_MUSICFM_URL = "https://huggingface.co/minzwon/MusicFM/resolve/main/pretrained_msd.pt"
_MUSICFM_SHA256 = "218b483a0256ddef736267425fabb166fd97008983696bb9270def464b47bded"
_MUSICFM_STATS_URL = "https://huggingface.co/minzwon/MusicFM/resolve/main/msd_stats.json"
_MUSICFM_STATS_SHA256 = "c36c61ab10ca4d2e7fdfefc3fcc15205316bec276a06a47baa3641a62c546f22"
# MuQ-large fetches through the HF hub inside `MuQ.from_pretrained`; pin the
# exact commit so the SSL backbone is reproducible like the sha256'd weights.
_MUQ_NAME = "OpenMuQ/MuQ-large-msd-iter"
_MUQ_REVISION = "0562a57814f6f8bbd9fdea0a25921a2fce1a841a"

_CACHE_DIR = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "loupe" / "songformer"
_CONFIG = str(_VENDOR / "configs" / "SongFormer.yaml")

# Chunked inference bounds peak RAM (spike: full-window OOMs >4.5 min on 16 GB).
# 180 s owned windows + 20 s context margins each side kept RAM ~0.2 GB.
_CHUNK_SECONDS = int(os.environ.get("LOUPE_STRUCTURE_CHUNK_SECONDS", "180"))
_OVERLAP_SECONDS = int(os.environ.get("LOUPE_STRUCTURE_OVERLAP_SECONDS", "20"))


def _device() -> str:
    """mps on Apple Silicon, cuda if present, else cpu (env-overridable)."""
    override = os.environ.get("LOUPE_STRUCTURE_DEVICE")
    if override:
        return override
    import torch

    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


_models: inference.Models | None = None
_models_lock = threading.Lock()
_structure_semaphore = asyncio.Semaphore(concurrency_slots("LOUPE_MAX_CONCURRENT_STRUCTURE"))


def _load() -> inference.Models:
    """The three models, loaded once (weights pinned) and reused."""
    global _models
    if _models is None:
        with _models_lock:
            if _models is None:
                import torch

                songformer = os.environ.get("LOUPE_STRUCTURE_CHECKPOINT") or str(
                    pinned_weights(
                        _SONGFORMER_URL, _SONGFORMER_SHA256, _CACHE_DIR / "SongFormer.safetensors"
                    )
                )
                musicfm = str(
                    pinned_weights(_MUSICFM_URL, _MUSICFM_SHA256, _CACHE_DIR / "pretrained_msd.pt")
                )
                stats = str(
                    pinned_weights(
                        _MUSICFM_STATS_URL, _MUSICFM_STATS_SHA256, _CACHE_DIR / "msd_stats.json"
                    )
                )
                _models = inference.load_models(
                    songformer_ckpt=songformer,
                    songformer_config=_CONFIG,
                    musicfm_ckpt=musicfm,
                    musicfm_stats=stats,
                    muq_name=_MUQ_NAME,
                    muq_revision=_MUQ_REVISION,
                    device=torch.device(_device()),
                )
    return _models


def _boundaries_to_segments(boundaries: list[tuple[float, str]]) -> list[Segment]:
    """SongFormer (time, label) breakpoints → [start, end) segments (slice-local)."""
    return [
        {"start": boundaries[i][0], "end": boundaries[i + 1][0], "label": boundaries[i][1]}
        for i in range(len(boundaries) - 1)
    ]


def _analyse(data: bytes) -> dict:
    """Decode + segment a mix WAV, chunked. Compute-bound, runs off the event loop."""
    signal, sample_rate = decode_wav_mono(data)
    if sample_rate != inference.INPUT_SAMPLING_RATE:
        signal = librosa.resample(
            signal, orig_sr=sample_rate, target_sr=inference.INPUT_SAMPLING_RATE
        )
    sr = inference.INPUT_SAMPLING_RATE
    duration = len(signal) / sr
    models = _load()
    chunks: list[tuple] = []
    for window in chunk_plan(duration, _CHUNK_SECONDS, _OVERLAP_SECONDS):
        a0, a1 = int(window["proc_start"] * sr), int(window["proc_end"] * sr)
        win = max(1, math.ceil(window["proc_end"] - window["proc_start"]))
        boundaries = inference.analyse_array(models, signal[a0:a1], win_size=win)
        chunks.append((window, _boundaries_to_segments(boundaries)))
    return {"segments": stitch_segments(chunks, duration)}


@router.post("/structure")
async def structure(request: Request) -> dict:
    data = await read_capped_body(request, MAX_UPLOAD_BYTES)
    try:
        async with _structure_semaphore:
            return await asyncio.wait_for(
                anyio.to_thread.run_sync(_analyse, data, abandon_on_cancel=True),
                timeout=INFERENCE_TIMEOUT_SECONDS,
            )
    except TimeoutError as exc:
        logger.exception("structure analysis timed out")
        raise HTTPException(status_code=504, detail="structure analysis timed out") from exc
    except WeightsUnavailable as exc:
        logger.exception("structure model unavailable")
        raise HTTPException(status_code=503, detail="structure model unavailable") from exc
    except Exception as exc:  # malformed upload / analysis failure
        logger.exception("structure analysis failed")
        raise HTTPException(status_code=400, detail="could not analyse audio") from exc
