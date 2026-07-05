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


def test_download_route_returns_ndjson():
    app = FastAPI()
    app.include_router(download.router)
    client = TestClient(app)
    res = client.post("/download", json={"url": "https://evil.example/x"})
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/x-ndjson")
    assert "unsupported source URL" in res.text
