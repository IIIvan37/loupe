"""Project persistence endpoints for loupe.

Implements the HTTP contract the web `http-project-store` /
`http-project-audio-store` adapters speak — the server side of the core's
`ProjectStore` / `ProjectAudioStore` ports:

    POST   /audio            body = raw bytes -> {"ref": "<sha256>"}
    GET    /audio/{ref}      -> the stored bytes (404 if unknown)
    GET    /projects         -> [manifest, ...]
    GET    /projects/{id}    -> manifest (404 if unknown)
    PUT    /projects/{id}    body = manifest JSON -> 204
    DELETE /projects/{id}    -> 204 (idempotent)

Audio refs are content-addressed (sha256 of the bytes): re-saving the same
audio re-points at the existing blob instead of duplicating it, and orphaned
blobs stay collectible by a manifest-scan GC — exactly what the core's
`ProjectAudioStore` doc asks of adapters. Manifests are opaque JSON: the core
owns the `Project` shape, this server only files it. Single-user, localhost.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request, Response

DATA_DIR = Path(
    os.environ.get("LOUPE_DATA_DIR", Path.home() / ".loupe")
).expanduser()
AUDIO_DIR = DATA_DIR / "audio"
PROJECTS_DIR = DATA_DIR / "projects"

# Refs are our own sha256 hex digests; ids are caller-minted (UUIDs in
# practice). Both gate what may appear in a filesystem path.
_REF_PATTERN = re.compile(r"^[0-9a-f]{64}$")
_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,128}$")

router = APIRouter()


def _audio_path(ref: str) -> Path:
    if not _REF_PATTERN.match(ref):
        raise HTTPException(status_code=404, detail="unknown audio ref")
    return AUDIO_DIR / ref


def _project_path(project_id: str) -> Path:
    if not _ID_PATTERN.match(project_id):
        raise HTTPException(status_code=404, detail="unknown project")
    return PROJECTS_DIR / f"{project_id}.json"


@router.post("/audio")
async def put_audio(request: Request) -> dict:
    data = await request.body()
    ref = hashlib.sha256(data).hexdigest()
    path = _audio_path(ref)
    if not path.exists():  # content-addressed: same bytes -> same file
        AUDIO_DIR.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_bytes(data)
        tmp.replace(path)  # atomic: never expose a half-written blob
    return {"ref": ref}


@router.get("/audio/{ref}")
async def get_audio(ref: str) -> Response:
    path = _audio_path(ref)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="unknown audio ref")
    return Response(path.read_bytes(), media_type="application/octet-stream")


@router.head("/audio/{ref}")
async def has_audio(ref: str) -> Response:
    """Existence probe: refs are content hashes, so a client that computed the
    hash locally can skip re-uploading a blob the server already has."""
    path = _audio_path(ref)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="unknown audio ref")
    return Response(status_code=200)


@router.get("/projects")
async def list_projects() -> list:
    if not PROJECTS_DIR.is_dir():
        return []
    manifests = []
    for path in sorted(PROJECTS_DIR.glob("*.json")):
        try:
            manifests.append(json.loads(path.read_text("utf-8")))
        except (OSError, ValueError):
            continue  # one corrupt manifest must not hide the others
    return manifests


@router.get("/projects/{project_id}")
async def get_project(project_id: str) -> Response:
    path = _project_path(project_id)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="unknown project")
    return Response(path.read_bytes(), media_type="application/json")


@router.put("/projects/{project_id}", status_code=204)
async def save_project(project_id: str, request: Request) -> Response:
    path = _project_path(project_id)
    data = await request.body()
    try:
        json.loads(data)  # opaque but must at least be JSON
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="manifest is not JSON") from exc
    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_bytes(data)
    tmp.replace(path)
    return Response(status_code=204)


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(project_id: str) -> Response:
    path = _project_path(project_id)
    path.unlink(missing_ok=True)
    return Response(status_code=204)
