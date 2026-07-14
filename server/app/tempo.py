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

import anyio.to_thread
import torch
from beat_this.inference import Audio2Beats
from fastapi import APIRouter, HTTPException, Request

from .beat_positions import tempo_payload
from .limits import (
    INFERENCE_TIMEOUT_SECONDS,
    MAX_UPLOAD_BYTES,
    concurrency_slots,
    read_capped_body,
)
from .wav_decode import decode_wav_mono

logger = logging.getLogger("loupe.tempo")
router = APIRouter()

# beat_this checkpoint: `final0` (~78 MB, best) by default; set `small0` (~8 MB)
# to trade a little accuracy for CPU latency. Fetched to ~/.cache/torch/hub on
# first use, like Demucs' weights.
CHECKPOINT = os.environ.get("LOUPE_TEMPO_CHECKPOINT", "final0")

# madmom's DBN post-processing decodes the most likely BAR SEQUENCE from the
# model's activations (a state space over bar lengths, meter changes penalised)
# instead of trusting the raw per-frame downbeat picks. Without it, whole
# passages can come back flagged at half-bar downbeats — a 4/4 song reading as
# runs of 2-beat bars (The Logical Song's intro), which the chord chart then
# dutifully marks as meter changes. On by default; LOUPE_TEMPO_DBN=0 restores
# the raw picks.
DBN = os.environ.get("LOUPE_TEMPO_DBN", "1") != "0"

# Pick the best available device, same order as separation. Overridable for the
# rare host where an accelerator lacks an op the model needs. The DBN path
# computes in float64, which MPS cannot represent — with the DBN on (the
# default) an Apple-Silicon host falls back to CPU (~4.4 s for 250 s of audio,
# measured; well inside the inference budget). An explicit LOUPE_TEMPO_DEVICE
# is honoured verbatim either way.
if os.environ.get("LOUPE_TEMPO_DEVICE"):
    _device = os.environ["LOUPE_TEMPO_DEVICE"]
elif torch.cuda.is_available():
    _device = "cuda"
elif torch.backends.mps.is_available() and not DBN:
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
                _model = Audio2Beats(checkpoint_path=CHECKPOINT, device=_device, dbn=DBN)
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
            # abandon_on_cancel: plain run_in_threadpool suppresses the
            # cancellation until the worker returns, so wait_for would never
            # fire on a truly wedged inference. Abandoning frees the request
            # and the slot; the orphaned thread keeps its threadpool token
            # (bounded, can't be killed) until it dies on its own.
            return await asyncio.wait_for(
                anyio.to_thread.run_sync(_analyse, data, abandon_on_cancel=True),
                timeout=INFERENCE_TIMEOUT_SECONDS,
            )
    except TimeoutError as exc:
        # The wait is cancelled but the worker thread can't be killed — free
        # the request and say so rather than hanging the client forever.
        logger.exception("tempo analysis timed out")
        raise HTTPException(status_code=504, detail="tempo analysis timed out") from exc
    except Exception as exc:  # malformed upload / analysis failure
        # Log the detail server-side; keep the client message generic so model
        # internals / paths don't leak (esp. reachable cross-origin).
        logger.exception("tempo analysis failed")
        raise HTTPException(status_code=400, detail="could not analyse audio") from exc
