"""Local server for loupe: project storage + Demucs separation.

Three independent capability groups behind one process:

- `projects` (always on): project manifests + content-addressed audio blobs —
  the server side of the core's `ProjectStore` / `ProjectAudioStore` ports.
- `separation` (when PyTorch/Demucs are installed): the `/separate` NDJSON
  contract. Imported lazily so a host without the ML stack (or its weights)
  still serves project storage; `/separate` then answers with an NDJSON error
  line and `/health` reports `"device": null`.
- `tempo` (when librosa is installed): the `/tempo` beat-tracking contract.
  Also imported lazily — a host without librosa still serves the rest, and
  `/tempo` answers with a 503 the client surfaces as an error.

Single-user, localhost — no auth. Run with `uvicorn app.main:app --port 8000`.
"""

from __future__ import annotations

import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .projects import router as projects_router

app = FastAPI(title="loupe server")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(projects_router)

try:
    from .separation import MODEL_NAME, device
    from .separation import router as separation_router
except Exception as exc:  # noqa: BLE001 - torch missing, weights unreachable…
    _unavailable = f"separation unavailable on this host: {exc}"
    MODEL_NAME = None
    device = None

    @app.post("/separate")
    async def separate() -> StreamingResponse:
        """Honour the NDJSON contract so the web client shows a clean error."""
        line = json.dumps({"type": "error", "message": _unavailable}) + "\n"
        return StreamingResponse(
            iter([line.encode("utf-8")]), media_type="application/x-ndjson"
        )
else:
    app.include_router(separation_router)

try:
    from .tempo import router as tempo_router
except Exception as exc:  # noqa: BLE001 - librosa missing on this host
    _tempo_unavailable = f"tempo detection unavailable on this host: {exc}"

    @app.post("/tempo")
    async def tempo() -> None:
        """Honour the contract with a clean error when librosa is absent."""
        raise HTTPException(status_code=503, detail=_tempo_unavailable)
else:
    app.include_router(tempo_router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "model": MODEL_NAME, "device": device}
