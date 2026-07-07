"""Tempo (beat + downbeat) endpoint for loupe — beat_this, optional at runtime.

Implements the HTTP contract the web `http-tempo-detector` adapter speaks:

    POST /tempo                body = mix WAV (audio/wav)
      -> 200 application/json   {"bpm": float,
                                 "beats": [{"time": s, "position": n}, ...]}

`position == 1` marks a downbeat. The DSP is CPJKU's "Beat This!" transformer
(beats *and* downbeats, MIT-licensed, robust to tempo/metre changes). This module
is the thin torch shell: decode the WAV, run the model, hand its two arrays to the
pure `beat_positions` helper (which numbers each beat within its bar + derives a
representative BPM). `main` imports it lazily so a host without torch/beat_this
still serves the rest — `/tempo` then answers with a 503 the client surfaces as
an error. The WAV is the exact 16-bit PCM `encodeWav` produces, decoded with the
stdlib.

Single-user, localhost — no auth.
"""

from __future__ import annotations

import asyncio
import logging
import os
import threading

import torch
from beat_this.inference import Audio2Beats
from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool

from .beat_positions import tempo_payload
from .limits import MAX_UPLOAD_BYTES, concurrency_slots, read_capped_body
from .wav_decode import decode_wav_mono

logger = logging.getLogger("loupe.tempo")
router = APIRouter()

# beat_this checkpoint: `final0` (~78 MB, best) by default; set `small0` (~8 MB)
# to trade a little accuracy for CPU latency. Fetched to ~/.cache/torch/hub on
# first use, like Demucs' weights.
CHECKPOINT = os.environ.get("LOUPE_TEMPO_CHECKPOINT", "final0")

# Pick the best available device, same order as separation. Overridable for the
# rare host where an accelerator lacks an op the model needs.
if os.environ.get("LOUPE_TEMPO_DEVICE"):
    _device = os.environ["LOUPE_TEMPO_DEVICE"]
elif torch.cuda.is_available():
    _device = "cuda"
elif torch.backends.mps.is_available():
    _device = "mps"
else:
    _device = "cpu"

# Built once, lazily on the first request (weights download + model load), then
# reused. A lock guards the one-time build against concurrent /tempo calls.
_model: Audio2Beats | None = None
_model_lock = threading.Lock()

# Bound the inference like /separate does: each beat_this pass pins the
# GPU/CPU, and `run_in_threadpool` alone would let ~40 run at once. The
# semaphore is async and taken in the route, so queued requests wait on the
# event loop — holding no threadpool token and no decoded signal (a threading
# semaphore inside the worker would pin both while blocked, starving the
# threadpool the NDJSON streams also run on). One at a time by default;
# env-tunable.
_tempo_semaphore = asyncio.Semaphore(concurrency_slots("LOUPE_MAX_CONCURRENT_TEMPO"))


def _audio2beats() -> Audio2Beats:
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                _model = Audio2Beats(checkpoint_path=CHECKPOINT, device=_device, dbn=False)
    return _model


def _analyse(data: bytes) -> dict:
    """Decode + beat-track a mix WAV. Compute-bound, so it runs off the event loop.

    `Audio2Beats` handles resampling to its own rate internally; we just pass the
    mono signal + its sample rate. It returns beat and downbeat instants (seconds)
    as separate arrays — the pure `tempo_payload` maps them to the enriched
    contract (one bar position per beat) and a median-interval BPM.
    """
    signal, sample_rate = decode_wav_mono(data)
    beats, downbeats = _audio2beats()(signal, sample_rate)
    return tempo_payload(beats.tolist(), downbeats.tolist())


@router.post("/tempo")
async def tempo(request: Request) -> dict:
    data = await read_capped_body(request, MAX_UPLOAD_BYTES)
    try:
        # Off the event loop: inference is compute-bound, and blocking here would
        # stall concurrent requests (e.g. the web app's /health poll) for seconds.
        async with _tempo_semaphore:
            return await run_in_threadpool(_analyse, data)
    except Exception as exc:  # malformed upload / analysis failure
        # Log the detail server-side; keep the client message generic so model
        # internals / paths don't leak (esp. reachable cross-origin).
        logger.exception("tempo analysis failed")
        raise HTTPException(status_code=400, detail="could not analyse audio") from exc
