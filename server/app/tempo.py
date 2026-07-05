"""Tempo (beat-tracking) endpoint for loupe — librosa, optional at runtime.

Implements the HTTP contract the web `http-tempo-detector` adapter speaks:

    POST /tempo                body = mix WAV (audio/wav)
      -> 200 application/json   {"bpm": float, "beats": [seconds, ...]}

The DSP is librosa's dynamic-programming beat tracker; this module is only the
glue. `main` imports it lazily so a host without librosa still serves the rest —
`/tempo` then answers with a 503 the client surfaces as an error. The WAV is the
exact 16-bit PCM `encodeWav` produces, decoded with the stdlib (no torch needed:
tempo detection is independent of the separation stack).

Single-user, localhost — no auth.
"""

from __future__ import annotations

import io
import logging
import wave

import librosa
import numpy as np
from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool

from .limits import MAX_UPLOAD_BYTES, read_capped_body

logger = logging.getLogger("loupe.tempo")
router = APIRouter()


def _load_mono(data: bytes) -> tuple[np.ndarray, int]:
    """Decode 16-bit PCM WAV bytes into a mono float signal + its sample rate."""
    with wave.open(io.BytesIO(data)) as reader:
        sample_rate = reader.getframerate()
        channel_count = reader.getnchannels()
        raw = reader.readframes(reader.getnframes())
    samples = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    if channel_count > 1:
        samples = samples.reshape(-1, channel_count).mean(axis=1)
    return samples, sample_rate


def _analyse(data: bytes) -> dict:
    """Decode + beat-track a mix WAV. CPU-bound, so it runs off the event loop."""
    signal, sample_rate = _load_mono(data)
    # Compute the onset envelope explicitly (mean aggregation) rather than
    # letting `beat_track` derive it: its internal median aggregation flattens
    # sharp transients at 44.1 kHz and can collapse the tempo estimate to zero.
    onset_env = librosa.onset.onset_strength(y=signal, sr=sample_rate)
    bpm, beat_frames = librosa.beat.beat_track(
        onset_envelope=onset_env, sr=sample_rate, units="frames"
    )
    beat_times = librosa.frames_to_time(beat_frames, sr=sample_rate)
    # librosa may hand back the tempo as a 1-element array; normalise to a float.
    return {
        "bpm": float(np.atleast_1d(bpm)[0]),
        "beats": [float(time) for time in beat_times],
    }


@router.post("/tempo")
async def tempo(request: Request) -> dict:
    data = await read_capped_body(request, MAX_UPLOAD_BYTES)
    try:
        # Off the event loop: librosa is CPU-bound, and blocking here would stall
        # concurrent requests (e.g. the web app's /health poll) for seconds.
        return await run_in_threadpool(_analyse, data)
    except Exception as exc:  # malformed upload / analysis failure
        # Log the detail server-side; keep the client message generic so librosa
        # internals / paths don't leak (esp. reachable cross-origin).
        logger.exception("tempo analysis failed")
        raise HTTPException(
            status_code=400, detail="could not analyse audio"
        ) from exc
