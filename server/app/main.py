"""Local server for loupe: project storage + Demucs separation.

Four independent capability groups behind one process:

- `projects` (always on): project manifests + content-addressed audio blobs —
  the server side of the core's `ProjectStore` / `ProjectAudioStore` ports.
- `separation` (when PyTorch/Demucs are installed): the `/separate` NDJSON
  contract. Imported lazily so a host without the ML stack (or its weights)
  still serves project storage; `/separate` then answers with an NDJSON error
  line and `/health` reports `"device": null`.
- `tempo` (when librosa is installed): the `/tempo` beat-tracking contract.
  Also imported lazily — a host without librosa still serves the rest, and
  `/tempo` answers with a 503 the client surfaces as an error.
- `download` (when yt-dlp is installed): the `/download` NDJSON contract that
  fetches a track from a media URL (YouTube / SoundCloud). Imported lazily — a
  host without yt-dlp still serves the rest, and `/download` answers with an
  NDJSON error line.

Single-user, localhost — no auth. Run with `uvicorn app.main:app --port 8000`.

The trust model is "only the local loupe web app talks to this server":
- **CORS** is restricted to the dev origin(s) (`LOUPE_ALLOWED_ORIGINS`,
  default `http://localhost:5173` + the 127.0.0.1 variant), never `*` — so a
  random page the user has open in the same browser cannot read our responses.
- **Host** header is validated (`LOUPE_ALLOWED_HOSTS`, default `localhost` +
  `127.0.0.1`) to blunt DNS-rebinding, which would otherwise let an attacker
  origin reach us over the loopback despite CORS.
Both are env-overridable so an operator can point the web app at a different
host, but the defaults are locked to the loopback dev setup.
"""

from __future__ import annotations

import contextlib
import json
import os
from collections.abc import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .projects import collect_garbage
from .projects import router as projects_router

_DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
_DEFAULT_HOSTS = "localhost,127.0.0.1"


def _env_list(name: str, default: str) -> list[str]:
    """Comma-separated env var → trimmed, non-empty entries (falls back to default)."""
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


@contextlib.asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Reclaim orphaned audio blobs on boot — the one moment nothing is in
    flight, so a manifest-scan GC can never race an upload. Best-effort: a
    failed sweep must not stop the server from serving."""
    with contextlib.suppress(Exception):
        collect_garbage()
    yield


app = FastAPI(title="loupe server", lifespan=lifespan)
# Host check first (outermost) so a rebinding request is rejected before anything
# else runs; then CORS scoped to the dev origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_env_list("LOUPE_ALLOWED_ORIGINS", _DEFAULT_ORIGINS),
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=_env_list("LOUPE_ALLOWED_HOSTS", _DEFAULT_HOSTS),
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

try:
    from .download import router as download_router
except Exception as exc:  # noqa: BLE001 - yt-dlp missing on this host
    _download_unavailable = f"track download unavailable on this host: {exc}"

    @app.post("/download")
    async def download() -> StreamingResponse:
        """Honour the NDJSON contract so the web client shows a clean error."""
        line = json.dumps({"type": "error", "message": _download_unavailable}) + "\n"
        return StreamingResponse(
            iter([line.encode("utf-8")]), media_type="application/x-ndjson"
        )
else:
    app.include_router(download_router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "model": MODEL_NAME, "device": device}
