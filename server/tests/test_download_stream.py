"""The /download NDJSON stream: progress → done, and the error paths.

Drives `_download_stream` directly with a fake `_extract` (no network, no real
yt-dlp run) and a stubbed `store_audio`, so we assert the emitted NDJSON without
touching YouTube. Run: `.venv/bin/python -m pytest`.
"""

from __future__ import annotations

import json

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import download


def _events(url: str) -> list[dict]:
    raw = b"".join(download._download_stream(url))
    return [json.loads(line) for line in raw.splitlines() if line]


def test_unsupported_url_yields_a_single_error():
    events = _events("https://evil.example/watch?v=x")
    assert events == [
        {"type": "error", "message": "unsupported source URL: https://evil.example/watch?v=x"}
    ]


def test_happy_path_streams_progress_then_done(monkeypatch):
    def fake_extract(url, out_dir, on_progress):
        (out_dir / "track.m4a").write_bytes(b"audio-bytes")
        return {"title": "Song", "duration": 12.5, "uploader": "Chan"}

    monkeypatch.setattr(download, "_extract", fake_extract)
    monkeypatch.setattr(download, "store_audio", lambda data: "ref123")

    events = _events("https://youtube.com/watch?v=x")

    assert events[0] == {"type": "progress", "phase": "downloading", "fraction": 0.0}
    done = events[-1]
    assert done == {
        "type": "done",
        "ref": "ref123",
        "title": "Song",
        "duration": 12.5,
        "uploader": "Chan",
    }


def test_missing_optional_metadata_falls_back_to_a_title(monkeypatch):
    def fake_extract(url, out_dir, on_progress):
        (out_dir / "track.m4a").write_bytes(b"x")
        return {}  # no title/duration/uploader

    monkeypatch.setattr(download, "_extract", fake_extract)
    monkeypatch.setattr(download, "store_audio", lambda data: "r")

    done = _events("https://youtu.be/x")[-1]
    assert done == {"type": "done", "ref": "r", "title": "Sans titre"}


def test_no_file_produced_is_an_error(monkeypatch):
    def fake_extract(url, out_dir, on_progress):
        return {"title": "Song"}  # writes nothing

    monkeypatch.setattr(download, "_extract", fake_extract)
    events = _events("https://youtube.com/watch?v=x")
    assert events[-1] == {"type": "error", "message": "download produced no file"}


def test_extraction_failure_is_generic(monkeypatch):
    def boom(url, out_dir, on_progress):
        raise RuntimeError("internal detail that must not leak")

    monkeypatch.setattr(download, "_extract", boom)
    events = _events("https://youtube.com/watch?v=x")
    assert events[-1] == {"type": "error", "message": "download failed"}


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(download.router)
    return TestClient(app)


def test_download_route_returns_ndjson():
    res = _client().post("/download", json={"url": "https://evil.example/x"})
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/x-ndjson")
    assert "unsupported source URL" in res.text


def test_download_body_over_cap_is_413(monkeypatch):
    """/download must reject an oversized body before buffering it (Lot F.1)."""
    monkeypatch.setattr(download, "MAX_MANIFEST_BYTES", 8)
    res = _client().post(
        "/download",
        content=b'{"url": "' + b"x" * 64 + b'"}',
        headers={"content-type": "application/json"},
    )
    assert res.status_code == 413


def test_download_body_not_json_is_400():
    res = _client().post(
        "/download",
        content=b"not json at all",
        headers={"content-type": "application/json"},
    )
    assert res.status_code == 400


def test_download_non_object_json_streams_unsupported_error():
    """A JSON array has no `url` — it must not crash the route."""
    res = _client().post("/download", json=[1, 2, 3])
    assert res.status_code == 200
    assert "unsupported source URL" in res.text


def test_full_audio_store_ends_the_stream_with_the_quota_error(monkeypatch):
    """`store_audio` refusing over quota must surface as an NDJSON error event,
    not a broken stream (the HTTP 200 is already committed by then)."""
    from fastapi import HTTPException

    def fake_extract(url, out_dir, on_progress):
        (out_dir / "track.m4a").write_bytes(b"audio-bytes")
        return {"title": "Song"}

    def full_store(data):
        raise HTTPException(status_code=507, detail="audio store quota exceeded")

    monkeypatch.setattr(download, "_extract", fake_extract)
    monkeypatch.setattr(download, "store_audio", full_store)

    events = _events("https://youtube.com/watch?v=x")

    assert events[-1] == {"type": "error", "message": "audio store quota exceeded"}
