"""Project + audio storage endpoints via a minimal app (torch-free).

Mounts only `projects.router` on a bare FastAPI app so the storage contract is
exercised without the ML stack or the loopback/host middleware. The fixture
repoints both store dirs at a tmp path. Run: `.venv/bin/python -m pytest`.
"""

from __future__ import annotations

import hashlib

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import projects


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(projects, "AUDIO_DIR", tmp_path / "audio")
    monkeypatch.setattr(projects, "PROJECTS_DIR", tmp_path / "projects")
    app = FastAPI()
    app.include_router(projects.router)
    return TestClient(app)


def test_put_then_get_and_head_audio(client):
    body = b"hello audio"
    ref = client.post("/audio", content=body).json()["ref"]
    assert ref == hashlib.sha256(body).hexdigest()
    assert client.get(f"/audio/{ref}").content == body
    assert client.head(f"/audio/{ref}").status_code == 200


def test_content_addressing_is_idempotent(client, tmp_path):
    body = b"same bytes"
    r1 = client.post("/audio", content=body).json()["ref"]
    r2 = client.post("/audio", content=body).json()["ref"]
    assert r1 == r2
    assert list((tmp_path / "audio").iterdir()) == [tmp_path / "audio" / r1]


def test_unknown_ref_is_404(client):
    absent = "a" * 64  # well-formed but never stored
    assert client.get(f"/audio/{absent}").status_code == 404
    assert client.head(f"/audio/{absent}").status_code == 404


def test_malformed_ref_is_404(client):
    assert client.get("/audio/not-a-sha").status_code == 404


def test_project_crud_roundtrip(client):
    manifest = {"id": "p1", "name": "Song"}
    assert client.put("/projects/p1", json=manifest).status_code == 204
    assert client.get("/projects/p1").json() == manifest
    assert client.get("/projects").json() == [manifest]
    assert client.delete("/projects/p1").status_code == 204
    assert client.get("/projects/p1").status_code == 404
    # Delete is idempotent — deleting a gone project still succeeds.
    assert client.delete("/projects/p1").status_code == 204


def test_put_rejects_non_json_manifest(client):
    assert client.put("/projects/p1", content=b"{ not json").status_code == 400


def test_malformed_project_id_is_404(client):
    assert client.get("/projects/bad*id").status_code == 404


def test_list_on_empty_store_is_empty(client):
    assert client.get("/projects").json() == []


def test_list_skips_a_corrupt_manifest(client, tmp_path):
    client.put("/projects/good", json={"id": "good"})
    (tmp_path / "projects" / "broken.json").write_text("{ nope", "utf-8")
    listed = client.get("/projects").json()
    assert listed == [{"id": "good"}]


def test_gc_endpoint_returns_a_summary(client):
    client.put("/projects/p1", json={"id": "p1"})
    result = client.post("/gc").json()
    assert result == {"deleted": 0, "reclaimedBytes": 0, "kept": 0}
