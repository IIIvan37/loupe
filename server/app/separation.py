"""Demucs separation endpoints for loupe (torch-heavy, optional at runtime).

Implements the HTTP contract the web `http-separator` adapter speaks:

    POST /separate              body = mix WAV (audio/wav)
      -> 200 application/x-ndjson, streamed line by line:
           {"type":"progress","phase":"analysing"|"separating","fraction":0..1}
           {"type":"done","stems":[{"id","label","url"}]}   (last line)
           {"type":"error","message"}                       (on failure)
    GET  /stems/{job}/{stem}.wav   -> the isolated stem as a 16-bit PCM WAV

The heavy lifting is PyTorch (Demucs, GPU-capable); this module is only the
glue + transport. Importing it loads the model — `main` imports it lazily so a
host without torch (or without the weights) still serves project storage.
Single-user, localhost — no auth, jobs kept on disk until the process exits.
"""

from __future__ import annotations

import json
import logging
import os
import queue
import threading
import time
import types
import uuid
import wave
from collections.abc import Iterator
from pathlib import Path

import demucs.apply
import numpy as np
import torch
import torchaudio
import tqdm
from demucs.apply import apply_model
from demucs.pretrained import get_model
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse

from . import stems_store
from .limits import MAX_UPLOAD_BYTES, concurrency_slots, read_capped_body, seconds_env
from .stem_manifest import build_manifest
from .wav_decode import decode_wav

logger = logging.getLogger("loupe.separation")

# Demucs 4's `apply_model` has no fraction callback, but it advances a tqdm bar
# per audio segment (`apply.py` ~line 248). We subclass tqdm to report each
# advance to a thread-local sink, then swap it into `demucs.apply` — the only way
# to get genuine `separating` progress without re-segmenting the mix ourselves.
_progress = threading.local()


class _ProgressTqdm(tqdm.tqdm):
    def update(self, n: float | None = 1) -> bool | None:
        result = super().update(n)
        sink = getattr(_progress, "sink", None)
        if sink is not None and self.total:
            sink(min(1.0, self.n / self.total))
        return result


demucs.apply.tqdm = types.SimpleNamespace(tqdm=_ProgressTqdm)  # pyright: ignore[reportPrivateImportUsage]

# `htdemucs_6s` is the 6-source model: it splits guitar and piano out of the
# "other" bucket, which is what makes the app's adaptive instrument detection
# (J2.3) worthwhile — a track without guitar/piano comes back near-silent on
# those stems and the UI masks them. `htdemucs` (4 stems) is faster; the piano
# stem in 6s is weaker/experimental. Override with DEMUCS_MODEL.
MODEL_NAME = os.environ.get("DEMUCS_MODEL", "htdemucs_6s")
TARGET_SAMPLE_RATE = 44100

router = APIRouter()

# Load the model once at startup; pick the best available device.
if torch.cuda.is_available():
    device = "cuda"
elif torch.backends.mps.is_available():
    device = "mps"
else:
    device = "cpu"
model = get_model(MODEL_NAME)
model.to(device)
model.eval()

stems_store.ensure_jobs_dir()

# Serialise the actual inference: each `apply_model` pins the GPU/CPU, so
# concurrent /separate calls (trivially reachable in a browser) would thrash the
# device or OOM it. One at a time by default; env-tunable.
_sep_semaphore = threading.BoundedSemaphore(concurrency_slots("LOUPE_MAX_CONCURRENT_SEPARATIONS"))

# Total wall-clock budget for one separation, queue wait included (a long
# track on CPU takes minutes, so the ceiling is generous).
SEPARATION_TIMEOUT_SECONDS = seconds_env("LOUPE_SEPARATION_TIMEOUT_SECONDS", 1800)


def _load_mix(data: bytes) -> torch.Tensor:
    """Decode 16-bit PCM WAV bytes into a stereo [channels, frames] tensor at
    44.1 kHz — the exact shape `encodeWav` produces, read with the stdlib so we
    need no audio I/O backend (torchaudio 2.11 dropped its built-in decoder)."""
    samples, sample_rate = decode_wav(data)
    waveform = torch.from_numpy(samples.T.copy())
    if sample_rate != TARGET_SAMPLE_RATE:
        waveform = torchaudio.functional.resample(waveform, sample_rate, TARGET_SAMPLE_RATE)
    if waveform.shape[0] == 1:  # mono -> stereo, the shape htdemucs expects
        waveform = waveform.repeat(2, 1)
    return waveform


def _save_wav(path: Path, audio: torch.Tensor, sample_rate: int) -> None:
    """Write a [channels, frames] float tensor as a 16-bit PCM WAV via the stdlib."""
    data = audio.cpu().numpy().T  # -> [frames, channels]
    clamped = np.clip(data, -1.0, 1.0)
    ints = np.where(clamped < 0, clamped * 32768.0, clamped * 32767.0).astype("<i2")
    with wave.open(str(path), "wb") as writer:
        writer.setnchannels(data.shape[1])
        writer.setsampwidth(2)
        writer.setframerate(sample_rate)
        writer.writeframes(ints.tobytes())


def _event(payload: dict) -> bytes:
    return (json.dumps(payload) + "\n").encode("utf-8")


def _run_separation(mix: torch.Tensor, events: queue.Queue) -> None:
    """Separate on a worker thread, pushing genuine progress onto `events`.

    The thread-local `sink` is read by the patched tqdm (same thread), turning
    Demucs' per-segment bar into `separating` fractions. A `('done', stems)` or
    `('error', message)` tuple ends the stream.
    """
    _progress.sink = lambda fraction: events.put(("progress", fraction))
    try:
        with _sep_semaphore, torch.no_grad():
            stems = apply_model(model, mix[None], device=device, progress=True)[0]
        events.put(("done", stems))
    except Exception:  # noqa: BLE001 - logged server-side, generic to the client
        logger.exception("separation failed")
        events.put(("error", "separation failed"))
    finally:
        _progress.sink = None


def _separate_stream(data: bytes, base_url: str) -> Iterator[bytes]:
    """Run separation, streaming live NDJSON progress then the stem manifest.

    FastAPI iterates this sync generator in a threadpool; the inference runs on a
    further worker thread so we can yield its progress as it arrives.
    """
    yield _event({"type": "progress", "phase": "analysing", "fraction": 0.0})

    try:
        mix = _load_mix(data)
    except Exception:  # malformed upload
        logger.exception("could not decode separation input")
        yield _event(
            {
                "type": "error",
                "message": "could not decode audio (expected 16-bit PCM WAV)",
            }
        )
        return

    yield _event({"type": "progress", "phase": "separating", "fraction": 0.0})

    events: queue.Queue = queue.Queue()
    worker = threading.Thread(target=_run_separation, args=(mix, events), daemon=True)
    worker.start()

    # Same total wall-clock budget as /download: a wedged inference (device
    # hang) must not suspend this threadpool thread forever, and a per-event
    # timeout would be reset by every tqdm progress tick.
    deadline = time.monotonic() + SEPARATION_TIMEOUT_SECONDS
    stems = None
    while True:
        remaining = deadline - time.monotonic()
        try:
            if remaining <= 0:
                raise queue.Empty
            kind, payload = events.get(timeout=remaining)
        except queue.Empty:
            yield _event({"type": "error", "message": "separation timed out"})
            return
        if kind == "progress":
            yield _event({"type": "progress", "phase": "separating", "fraction": payload})
        elif kind == "error":
            yield _event({"type": "error", "message": payload})
            return
        else:  # done
            stems = payload
            break

    stems_store.sweep_old_jobs(time.time())  # reclaim WAVs past their TTL
    job = uuid.uuid4().hex
    job_dir = stems_store.new_job_dir(job)
    sources = list(model.sources)
    manifest = []
    for entry in build_manifest(sources, job, base_url):
        audio = stems[sources.index(entry.source)]
        _save_wav(job_dir / f"{entry.id}.wav", audio, TARGET_SAMPLE_RATE)
        manifest.append({"id": entry.id, "label": entry.label, "url": entry.url})

    yield _event({"type": "done", "stems": manifest})


@router.post("/separate")
async def separate(request: Request) -> StreamingResponse:
    data = await read_capped_body(request, MAX_UPLOAD_BYTES)
    base_url = str(request.base_url)  # ends with '/'
    return StreamingResponse(
        _separate_stream(data, base_url),
        media_type="application/x-ndjson",
    )


@router.get("/stems/{job}/{stem}.wav")
async def stem(job: str, stem: str) -> FileResponse:
    path = stems_store.resolve_stem_path(job, stem)
    if path is None:
        raise HTTPException(status_code=404, detail="stem not found")
    return FileResponse(path, media_type="audio/wav")
