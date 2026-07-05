"""Request-body size caps — refuse oversized uploads before buffering them.

`await request.body()` reads the whole body into memory first; on an
unauthenticated localhost server a single huge POST is then a trivial
memory-exhaustion / disk-fill DoS. `read_capped_body` refuses a body over the cap
both up front (declared `Content-Length`) and while streaming (a lying or chunked
length), so nothing oversized is ever fully buffered.

Caps are env-overridable (audio uploads are legitimately large — a full-track WAV
runs to hundreds of MB — while manifests are tiny JSON).
"""

from __future__ import annotations

import os

from fastapi import HTTPException, Request


def _mb_env(name: str, default_mb: int) -> int:
    raw = os.environ.get(name, str(default_mb))
    mb = int(raw) if raw.isdigit() else default_mb
    return mb * 1024 * 1024


MAX_UPLOAD_BYTES = _mb_env("LOUPE_MAX_UPLOAD_MB", 500)
MAX_MANIFEST_BYTES = _mb_env("LOUPE_MAX_MANIFEST_MB", 16)


async def read_capped_body(request: Request, max_bytes: int) -> bytes:
    """Read the request body, raising 413 if it exceeds `max_bytes`.

    Checks the declared `Content-Length` first (cheap rejection), then enforces
    the cap chunk by chunk so a missing or understated length can't slip through.
    """
    declared = request.headers.get("content-length")
    if declared is not None and declared.isdigit() and int(declared) > max_bytes:
        raise HTTPException(status_code=413, detail="request body too large")

    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(status_code=413, detail="request body too large")
        chunks.append(chunk)
    return b"".join(chunks)
