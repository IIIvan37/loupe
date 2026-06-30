"""Local Demucs separation server for loupe.

Implements the HTTP contract the web `http-separator` adapter speaks:

    POST /separate              body = mix WAV (audio/wav)
      -> 200 application/x-ndjson, streamed line by line:
           {"type":"progress","phase":"analysing"|"separating","fraction":0..1}
           {"type":"done","stems":[{"id","label","url"}]}   (last line)
           {"type":"error","message"}                       (on failure)
    GET  /stems/{job}/{stem}.wav   -> the isolated stem as a 16-bit PCM WAV

The heavy lifting is PyTorch (Demucs, GPU-capable); this process is only the
glue + transport. Single-user, localhost — no auth, jobs kept on disk until the
process exits.
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
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
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

# `htdemucs` is a single model (fast); `htdemucs_ft` is a bag of 4 fine-tuned
# models — best quality but ~4x slower. Override with DEMUCS_MODEL.
MODEL_NAME = os.environ.get("DEMUCS_MODEL", "htdemucs")
TARGET_SAMPLE_RATE = 44100

# Map Demucs' source names to the musician-friendly ids/labels the core's
# `stem-layout` expects, so the stems line up with the in-browser engines.
STEM_META: dict[str, tuple[str, str]] = {
    "vocals": ("voix", "Voix"),
    "drums": ("batterie", "Batterie"),
    "bass": ("basse", "Basse"),
    "other": ("autres", "Autres"),
}

# Musician-friendly display order, matching the in-browser engines' `stem-layout`
# so switching engines never reshuffles the UI. Demucs' native order is
# [drums, bass, other, vocals].
DISPLAY_ORDER = ["vocals", "drums", "bass", "other"]

app = FastAPI(title="loupe separator")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.post("/separate")
async def separate(request: Request) -> StreamingResponse:
    data = await request.body()
    base_url = str(request.base_url)  # ends with '/'
    return StreamingResponse(
        _separate_stream(data, base_url),
        media_type="application/x-ndjson",
    )


@app.get("/stems/{job}/{stem}.wav")
async def stem(job: str, stem: str) -> FileResponse:
    path = JOBS_DIR / job / f"{stem}.wav"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="stem not found")
    return FileResponse(path, media_type="audio/wav")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "model": MODEL_NAME, "device": device}
