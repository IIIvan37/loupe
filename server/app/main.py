"""Local server for loupe: project storage + Demucs separation.

Four independent capability groups behind one process:

- `projects` (always on): project manifests + content-addressed audio blobs —
  the server side of the core's `ProjectStore` / `ProjectAudioStore` ports.
- `separation` (when PyTorch/Demucs are installed): the `/separate` NDJSON
  contract. Imported lazily so a host without the ML stack (or its weights)
  still serves project storage; `/separate` then answers with an NDJSON error
  line and `/health` reports `"device": null`.
- `tempo` (when torch/beat_this is installed): the `/tempo` beat + downbeat
  contract. Also imported lazily — a host without the ML stack still serves the
  rest, and `/tempo` answers with a 503 the client surfaces as an error.
- `chords` (when torch is installed): the `/chords` timestamped chord-span
  contract (vendored BTC model). Same lazy-import + 503 pattern as `tempo`.
- `structure` (when torch + the SongFormer stack are installed): the
  `/structure` functional-segment contract (vendored SongFormer, chunked
  inference). Same lazy-import + 503 pattern as `chords`.
- `download` (when yt-dlp is installed): the `/download` NDJSON contract that
  fetches a track from a media URL (YouTube / SoundCloud). Imported lazily — a
  host without yt-dlp still serves the rest, and `/download` answers with an
  NDJSON error line.

Single-user, localhost — no auth. Run with `uvicorn app.main:app --port 8000`.

The trust model is "only the local loupe web app talks to this server":
- **CORS** is restricted to the dev origin(s) (`LOUPE_ALLOWED_ORIGINS`,
  default `http://localhost:5173` + the 127.0.0.1 variant), never `*` — so a
  random page the user has open in the same browser cannot read our responses.
- **Origin** is enforced, not just CORS'd: CORS blocks reads, not sends — a
  "simple request" POST needs no preflight, so any request bearing an Origin
  outside `LOUPE_ALLOWED_ORIGINS` is refused with 403 (no Origin = not a
  browser = pass).
- **Host** header is validated (`LOUPE_ALLOWED_HOSTS`, default `localhost` +
  `127.0.0.1`) to blunt DNS-rebinding, which would otherwise let an attacker
  origin reach us over the loopback despite CORS.
All are env-overridable so an operator can point the web app at a different
host, but the defaults are locked to the loopback dev setup.
"""

from __future__ import annotations

import contextlib
import json
from collections.abc import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .netguard import LoopbackOnlyMiddleware, OriginGuardMiddleware
from .origins import allowed_origins, env_list
from .projects import collect_garbage
from .projects import router as projects_router

_DEFAULT_HOSTS = "localhost,127.0.0.1"


@contextlib.asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Reclaim orphaned audio blobs on boot — the one moment nothing is in
    flight, so a manifest-scan GC can never race an upload. Best-effort: a
    failed sweep must not stop the server from serving."""
    with contextlib.suppress(Exception):
        collect_garbage()
    yield


app = FastAPI(title="loupe server", lifespan=lifespan)
# Middleware onion, innermost first (add_middleware: last added = outermost):
# CORS < OriginGuard < TrustedHost < LoopbackOnly — so a request is vetted
# network-first (loopback, then Host, then Origin) before CORS ever sees it.
_allowed_origins = allowed_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
# CORS only stops a foreign page from READING us; a "simple request" POST
# (text/plain, no preflight) could still fire /download, /audio, inference or
# /gc. Refuse any request whose Origin is present and not the loupe app's.
app.add_middleware(OriginGuardMiddleware, allowed_origins=_allowed_origins)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=env_list("LOUPE_ALLOWED_HOSTS", _DEFAULT_HOSTS),
)
# Outermost: refuse a request that didn't land on loopback before anything else,
# so a `--host 0.0.0.0` mistake can't expose the server to the LAN even if the
# Host header is forged.
app.add_middleware(LoopbackOnlyMiddleware)
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
        return StreamingResponse(iter([line.encode("utf-8")]), media_type="application/x-ndjson")
else:
    app.include_router(separation_router)

try:
    from .tempo import router as tempo_router
except Exception as exc:  # noqa: BLE001 - torch/beat_this missing on this host
    _tempo_unavailable = f"tempo detection unavailable on this host: {exc}"

    @app.post("/tempo")
    async def tempo() -> None:
        """Honour the contract with a clean error when beat_this is absent."""
        raise HTTPException(status_code=503, detail=_tempo_unavailable)
else:
    app.include_router(tempo_router)

try:
    from .chords import router as chords_router
except Exception as exc:  # noqa: BLE001 - torch missing on this host
    _chords_unavailable = f"chord detection unavailable on this host: {exc}"

    @app.post("/chords")
    async def chords() -> None:
        """Honour the contract with a clean error when torch is absent."""
        raise HTTPException(status_code=503, detail=_chords_unavailable)
else:
    app.include_router(chords_router)

try:
    from .structure import router as structure_router
except Exception as exc:  # noqa: BLE001 - torch/SongFormer stack missing on this host
    _structure_unavailable = f"structure detection unavailable on this host: {exc}"

    @app.post("/structure")
    async def structure() -> None:
        """Honour the contract with a clean error when the ML stack is absent."""
        raise HTTPException(status_code=503, detail=_structure_unavailable)
else:
    app.include_router(structure_router)

try:
    from .download import router as download_router
except Exception as exc:  # noqa: BLE001 - yt-dlp missing on this host
    _download_unavailable = f"track download unavailable on this host: {exc}"

    @app.post("/download")
    async def download() -> StreamingResponse:
        """Honour the NDJSON contract so the web client shows a clean error."""
        line = json.dumps({"type": "error", "message": _download_unavailable}) + "\n"
        return StreamingResponse(iter([line.encode("utf-8")]), media_type="application/x-ndjson")
else:
    app.include_router(download_router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "model": MODEL_NAME, "device": device}
