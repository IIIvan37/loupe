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

import io
import json
import os
import queue
import tempfile
import threading
import types
import uuid
import wave
from pathlib import Path
from typing import Iterator

import demucs.apply
import numpy as np
import torch
import torchaudio
import tqdm
from demucs.apply import apply_model
from demucs.pretrained import get_model
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse

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


demucs.apply.tqdm = types.SimpleNamespace(tqdm=_ProgressTqdm)

# `htdemucs_6s` is the 6-source model: it splits guitar and piano out of the
# "other" bucket, which is what makes the app's adaptive instrument detection
# (J2.3) worthwhile — a track without guitar/piano comes back near-silent on
# those stems and the UI masks them. `htdemucs` (4 stems) is faster; the piano
# stem in 6s is weaker/experimental. Override with DEMUCS_MODEL.
MODEL_NAME = os.environ.get("DEMUCS_MODEL", "htdemucs_6s")
TARGET_SAMPLE_RATE = 44100

# Map Demucs' source names to the musician-friendly ids/labels the UI expects.
# The web reserves a colour per id (voix/batterie/basse/guitare/claviers/autres).
STEM_META: dict[str, tuple[str, str]] = {
    "vocals": ("voix", "Voix"),
    "drums": ("batterie", "Batterie"),
    "bass": ("basse", "Basse"),
    "guitar": ("guitare", "Guitare"),
    "piano": ("claviers", "Claviers"),
    "other": ("autres", "Autres"),
}

# Musician-friendly display order. Demucs' native order differs per model
# (4s: [drums, bass, other, vocals]; 6s adds guitar, piano), so we re-order to a
# stable UI layout. Sources absent from the loaded model are simply skipped.
DISPLAY_ORDER = ["vocals", "drums", "bass", "guitar", "piano", "other"]

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

JOBS_DIR = Path(tempfile.gettempdir()) / "loupe-stems"
JOBS_DIR.mkdir(parents=True, exist_ok=True)


def _load_mix(data: bytes) -> torch.Tensor:
    """Decode 16-bit PCM WAV bytes into a stereo [channels, frames] tensor at
    44.1 kHz — the exact shape `encodeWav` produces, read with the stdlib so we
    need no audio I/O backend (torchaudio 2.11 dropped its built-in decoder)."""
    with wave.open(io.BytesIO(data)) as reader:
        sample_rate = reader.getframerate()
        channel_count = reader.getnchannels()
        raw = reader.readframes(reader.getnframes())
    samples = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    waveform = torch.from_numpy(samples.reshape(-1, channel_count).T.copy())
    if sample_rate != TARGET_SAMPLE_RATE:
        waveform = torchaudio.functional.resample(
            waveform, sample_rate, TARGET_SAMPLE_RATE
        )
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


def _run_separation(mix: torch.Tensor, events: "queue.Queue") -> None:
    """Separate on a worker thread, pushing genuine progress onto `events`.

    The thread-local `sink` is read by the patched tqdm (same thread), turning
    Demucs' per-segment bar into `separating` fractions. A `('done', stems)` or
    `('error', message)` tuple ends the stream.
    """
    _progress.sink = lambda fraction: events.put(("progress", fraction))
    try:
        with torch.no_grad():
            stems = apply_model(model, mix[None], device=device, progress=True)[0]
        events.put(("done", stems))
    except Exception as exc:  # noqa: BLE001 - surfaced to the client
        events.put(("error", str(exc)))
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
    except Exception as exc:  # malformed upload
        yield _event({"type": "error", "message": f"could not decode WAV: {exc}"})
        return

    yield _event({"type": "progress", "phase": "separating", "fraction": 0.0})

    events: "queue.Queue" = queue.Queue()
    worker = threading.Thread(
        target=_run_separation, args=(mix, events), daemon=True
    )
    worker.start()

    stems = None
    while True:
        kind, payload = events.get()
        if kind == "progress":
            yield _event(
                {"type": "progress", "phase": "separating", "fraction": payload}
            )
        elif kind == "error":
            yield _event({"type": "error", "message": payload})
            return
        else:  # done
            stems = payload
            break

    job = uuid.uuid4().hex
    job_dir = JOBS_DIR / job
    job_dir.mkdir(parents=True, exist_ok=True)
    sources = list(model.sources)
    ordered = sorted(
        sources,
        key=lambda name: DISPLAY_ORDER.index(name)
        if name in DISPLAY_ORDER
        else len(DISPLAY_ORDER),
    )
    manifest = []
    for name in ordered:
        stem_id, label = STEM_META.get(name, (name, name.title()))
        path = job_dir / f"{stem_id}.wav"
        _save_wav(path, stems[sources.index(name)], TARGET_SAMPLE_RATE)
        manifest.append(
            {"id": stem_id, "label": label, "url": f"{base_url}stems/{job}/{stem_id}.wav"}
        )

    yield _event({"type": "done", "stems": manifest})


@router.post("/separate")
async def separate(request: Request) -> StreamingResponse:
    data = await request.body()
    base_url = str(request.base_url)  # ends with '/'
    return StreamingResponse(
        _separate_stream(data, base_url),
        media_type="application/x-ndjson",
    )


@router.get("/stems/{job}/{stem}.wav")
async def stem(job: str, stem: str) -> FileResponse:
    path = JOBS_DIR / job / f"{stem}.wav"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="stem not found")
    return FileResponse(path, media_type="audio/wav")

