"""Chord estimation endpoint for loupe — vendored BTC, optional at runtime.

Implements the HTTP contract the web chord-detector adapter speaks:

    POST /chords               body = mix WAV (audio/wav)
      -> 200 application/json   {"chords": [{"start": s, "end": s,
                                             "label": "A:min"}, ...]}

Labels are mir syntax from the 25-class maj-min vocabulary (`N` = no chord);
translating them into the web grid's own chord tokens is the adapter's job.
The model is BTC (Park et al., ISMIR 2019, MIT), vendored under `app/btc/` and
run on the full mix — its training regime. This module is the thin torch
shell: decode the WAV, resample, CQT, run the model per window, and hand the
frame indices to the pure `chord_spans` helper. `main` imports it lazily so a
host without torch still serves the rest — `/chords` then answers with a 503
the client surfaces as an error. The WAV is the exact 16-bit PCM `encodeWav`
produces, decoded with the stdlib.

Single-user, localhost — no auth.
"""

from __future__ import annotations

import asyncio
import logging
import os
import threading
from pathlib import Path

import librosa
import numpy as np
import torch

from .btc import BTC_model
from .chord_spans import chord_spans
from .limits import MAX_UPLOAD_BYTES, concurrency_slots, read_capped_body
from .wav_decode import decode_wav_mono
from .weights_cache import WeightsUnavailable, pinned_weights

from fastapi import APIRouter, HTTPException, Request  # isort: skip
from fastapi.concurrency import run_in_threadpool  # isort: skip

logger = logging.getLogger("loupe.chords")
router = APIRouter()

# The published maj-min checkpoint (~33 MB) from the BTC repo, fetched to the
# cache on first use — like Demucs'/beat_this' weights — but PINNED by sha256:
# `torch.load` unpickles arbitrary objects (the checkpoint predates safetensors
# and carries numpy scalars, so `weights_only=True` cannot load it), so we only
# ever unpickle the exact audited artifact. Point LOUPE_CHORDS_CHECKPOINT at a
# local copy to skip the download.
WEIGHTS_URL = "https://github.com/jayg996/BTC-ISMIR19/raw/master/test/btc_model.pt"
WEIGHTS_SHA256 = "71c2c5db17e8c43b8a9a9da5db36ef2d667158c07a214eba16344c154c00bf54"
_CACHE_DIR = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "loupe" / "btc"

# The training-time hyperparameters of that checkpoint (run_config.yaml in the
# BTC repo) — the tensor shapes are baked into the weights, so these are facts
# of the artifact, not tunables.
SONG_HZ = 22050
WINDOW_SECONDS = 10.0
N_BINS = 144
BINS_PER_OCTAVE = 24
HOP_LENGTH = 2048
TIMESTEP = 108
MODEL_CONFIG = {
    "feature_size": 144,
    "timestep": TIMESTEP,
    "num_chords": 25,
    "input_dropout": 0.2,
    "layer_dropout": 0.2,
    "attention_dropout": 0.2,
    "relu_dropout": 0.2,
    "num_layers": 8,
    "num_heads": 4,
    "hidden_size": 128,
    "total_key_depth": 128,
    "total_value_depth": 128,
    "filter_size": 128,
    "loss": "ce",
    "probs_out": False,
}

# CPU is plenty (~2.4 s for a 4-minute song, measured); honour an override for
# hosts where an accelerator is worth it.
_device = os.environ.get("LOUPE_CHORDS_DEVICE", "cpu")

# Built once, lazily on the first request (weights download + model load), then
# reused. A lock guards the one-time build against concurrent /chords calls.
_model: tuple[BTC_model, float, float] | None = None
_model_lock = threading.Lock()

# One inference at a time by default (env-tunable), for the same reason as
# /tempo: each pass pins the CPU, and the semaphore is async so queued
# requests hold no threadpool token while they wait.
_chords_semaphore = asyncio.Semaphore(concurrency_slots("LOUPE_MAX_CONCURRENT_CHORDS"))


def _weights_path() -> Path:
    """The checkpoint on disk — env override, or checksum-pinned download."""
    override = os.environ.get("LOUPE_CHORDS_CHECKPOINT")
    if override:
        return Path(override)
    return pinned_weights(WEIGHTS_URL, WEIGHTS_SHA256, _CACHE_DIR / "btc_model.pt")


def _btc() -> tuple[BTC_model, float, float]:
    """The loaded model plus the checkpoint's feature mean/std, built once."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                checkpoint = torch.load(_weights_path(), map_location=_device, weights_only=False)
                model = BTC_model(config=MODEL_CONFIG).to(_device)
                model.load_state_dict(checkpoint["model"])
                model.eval()
                _model = (model, float(checkpoint["mean"]), float(checkpoint["std"]))
    return _model


def _features(signal: np.ndarray, sample_rate: int) -> np.ndarray:
    """Log-CQT features at the model's rate, computed in training-size chunks."""
    if sample_rate != SONG_HZ:
        signal = librosa.resample(signal, orig_sr=sample_rate, target_sr=SONG_HZ)
    chunk = int(SONG_HZ * WINDOW_SECONDS)
    chunks = [signal[start : start + chunk] for start in range(0, len(signal), chunk)]
    parts = [
        librosa.cqt(
            segment,
            sr=SONG_HZ,
            n_bins=N_BINS,
            bins_per_octave=BINS_PER_OCTAVE,
            hop_length=HOP_LENGTH,
        )
        # A 1-sample tail (len % chunk == 1) is too short for the CQT and
        # would fail the whole analysis; dropping it loses < one hop of audio.
        for segment in chunks
        if len(segment) > 1
    ]
    if not parts:
        raise ValueError("audio too short to analyse")
    return np.log(np.abs(np.concatenate(parts, axis=1)) + 1e-6)


def _analyse(data: bytes) -> dict:
    """Decode + chord-track a mix WAV. Compute-bound, so it runs off the event loop."""
    signal, sample_rate = decode_wav_mono(data)
    song_length = len(signal) / sample_rate
    model, mean, std = _btc()
    feature = (_features(signal, sample_rate).T - mean) / std
    seconds_per_frame = WINDOW_SECONDS / TIMESTEP
    pad = -feature.shape[0] % TIMESTEP
    feature = np.pad(feature, ((0, pad), (0, 0)), mode="constant")
    frames: list[int] = []
    with torch.no_grad():
        batch = torch.tensor(feature, dtype=torch.float32, device=_device).unsqueeze(0)
        for window in range(feature.shape[0] // TIMESTEP):
            segment = batch[:, TIMESTEP * window : TIMESTEP * (window + 1), :]
            encoded, _ = model.self_attn_layers(segment)
            prediction, _ = model.output_layer(encoded)
            frames.extend(int(p) for p in prediction.squeeze(0))
    return {"chords": chord_spans(frames, seconds_per_frame, song_length)}


@router.post("/chords")
async def chords(request: Request) -> dict:
    data = await read_capped_body(request, MAX_UPLOAD_BYTES)
    try:
        # Off the event loop: inference is compute-bound, and blocking here
        # would stall concurrent requests (e.g. the /health poll) for seconds.
        async with _chords_semaphore:
            return await run_in_threadpool(_analyse, data)
    except WeightsUnavailable as exc:
        # Host not provisioned (weights unfetchable / failing their pin) — the
        # client's audio is fine, so answer like a missing ML stack does.
        logger.exception("chord model unavailable")
        raise HTTPException(status_code=503, detail="chord model unavailable") from exc
    except Exception as exc:  # malformed upload / analysis failure
        # Log the detail server-side; keep the client message generic so model
        # internals / paths don't leak (esp. reachable cross-origin).
        logger.exception("chord analysis failed")
        raise HTTPException(status_code=400, detail="could not analyse audio") from exc
