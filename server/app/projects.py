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
    POST   /gc               -> {"deleted", "reclaimedBytes", "kept"} sweep

Audio refs are content-addressed (sha256 of the bytes): re-saving the same
audio re-points at the existing blob instead of duplicating it, and orphaned
blobs (from re-saves and deletes) are reclaimed by the manifest-scan GC
(`collect_garbage`) — exactly what the core's `ProjectAudioStore` doc asks of
adapters. Manifests are opaque JSON: the core owns the `Project` shape, this
server only files it. Single-user, localhost.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from collections.abc import Iterable
from pathlib import Path
from typing import Any

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


def store_audio(data: bytes) -> str:
    """Park bytes in the content-addressed store, returning their sha256 ref.

    The single seam other capability groups (e.g. `download`) reuse so a fetched
    track lands in the SAME `/audio` store the web client `GET`s from — never a
    forked second store. Idempotent: identical bytes re-point at the one blob.
    """
    ref = hashlib.sha256(data).hexdigest()
    path = _audio_path(ref)
    if not path.exists():  # content-addressed: same bytes -> same file
        AUDIO_DIR.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_bytes(data)
        tmp.replace(path)  # atomic: never expose a half-written blob
    return ref


@router.post("/audio")
async def put_audio(request: Request) -> dict:
    data = await request.body()
    return {"ref": store_audio(data)}


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


def referenced_refs(manifests: Iterable[Any]) -> set[str]:
    """Every audio ref the given manifests point at.

    Manifests stay opaque: an audio ref is any sha256-shaped string anywhere in
    the JSON (the source, each stem, and any future ref-bearing field), so this
    never needs to know the `Project` shape. Nothing else in a manifest is a
    64-char hex string, so there are no false positives.
    """
    refs: set[str] = set()

    def walk(node: Any) -> None:
        if isinstance(node, str):
            if _REF_PATTERN.match(node):
                refs.add(node)
        elif isinstance(node, dict):
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    for manifest in manifests:
        walk(manifest)
    return refs


def collect_garbage() -> dict:
    """Reclaim content-addressed blobs no manifest references.

    A manifest-scan GC, exactly what the core's `ProjectAudioStore` doc defers
    to the adapter: gather every ref the manifests use, delete every blob whose
    name is not among them. **Conservative** — if any manifest can't be parsed
    we abort without deleting a thing, since we cannot account for its refs and
    would risk erasing live audio. Run when idle: a blob just uploaded but not
    yet named by a saved manifest would look orphaned.
    """
    manifests: list[Any] = []
    unreadable = 0
    if PROJECTS_DIR.is_dir():
        for path in sorted(PROJECTS_DIR.glob("*.json")):
            try:
                manifests.append(json.loads(path.read_text("utf-8")))
            except (OSError, ValueError):
                unreadable += 1
    if unreadable:
        return {"deleted": 0, "reclaimedBytes": 0, "skipped": True,
                "unreadableManifests": unreadable}

    live = referenced_refs(manifests)
    deleted = 0
    reclaimed = 0
    if AUDIO_DIR.is_dir():
        for path in AUDIO_DIR.iterdir():
            # Only touch our own content-addressed blobs; leave .tmp files and
            # anything else the store did not name with a bare sha256.
            if not (path.is_file() and _REF_PATTERN.match(path.name)):
                continue
            if path.name not in live:
                reclaimed += path.stat().st_size
                path.unlink(missing_ok=True)
                deleted += 1
    return {"deleted": deleted, "reclaimedBytes": reclaimed, "kept": len(live)}


@router.post("/gc")
async def gc() -> dict:
    """Sweep orphaned audio blobs. Idempotent; safe to call when idle."""
    return collect_garbage()
