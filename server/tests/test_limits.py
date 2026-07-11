"""Body-size caps refuse oversized uploads before buffering them.

`read_capped_body` is torch-free, so we drive it directly with a minimal fake
request (declared length, streamed chunks) via `asyncio.run` — no HTTP server or
event-loop fixture needed. Run from the server root: `.venv/bin/python -m pytest`.
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException

from app import limits


class FakeRequest:
    def __init__(self, chunks, headers=None):
        self._chunks = chunks
        self.headers = headers or {}

    async def stream(self):
        for chunk in self._chunks:
            yield chunk


def _read(request, max_bytes):
    return asyncio.run(limits.read_capped_body(request, max_bytes))


def test_returns_body_under_cap():
    req = FakeRequest([b"ab", b"cd"], {"content-length": "4"})
    assert _read(req, 10) == b"abcd"


def test_rejects_declared_oversize_up_front():
    req = FakeRequest([b"x"], {"content-length": "1000"})
    with pytest.raises(HTTPException) as excinfo:
        _read(req, 5)
    assert excinfo.value.status_code == 413


def test_rejects_streamed_oversize_when_length_understated():
    """A lying/absent Content-Length can't slip past — the stream is capped too."""
    req = FakeRequest([b"abc", b"def"], {"content-length": "1"})
    with pytest.raises(HTTPException) as excinfo:
        _read(req, 4)
    assert excinfo.value.status_code == 413


def test_rejects_streamed_oversize_without_length_header():
    req = FakeRequest([b"a" * 10])
    with pytest.raises(HTTPException) as excinfo:
        _read(req, 4)
    assert excinfo.value.status_code == 413


def test_default_caps_are_sane():
    assert limits.MAX_UPLOAD_BYTES == 500 * 1024 * 1024
    assert limits.MAX_MANIFEST_BYTES == 16 * 1024 * 1024


def test_read_capped_json_returns_bytes_and_parsed_value():
    req = FakeRequest([b'{"url": "x"}'])
    data, body = asyncio.run(limits.read_capped_json(req, 100))
    assert data == b'{"url": "x"}'
    assert body == {"url": "x"}


def test_read_capped_json_rejects_non_json_as_400():
    req = FakeRequest([b"not json"])
    with pytest.raises(HTTPException) as excinfo:
        asyncio.run(limits.read_capped_json(req, 100, "manifest is not JSON"))
    assert excinfo.value.status_code == 400
    assert excinfo.value.detail == "manifest is not JSON"


def test_read_capped_json_keeps_the_413_cap():
    req = FakeRequest([b"x" * 50])
    with pytest.raises(HTTPException) as excinfo:
        asyncio.run(limits.read_capped_json(req, 10))
    assert excinfo.value.status_code == 413


def test_concurrency_slots_defaults_to_one_without_env(monkeypatch):
    monkeypatch.delenv("LOUPE_TEST_SLOTS", raising=False)
    assert limits.concurrency_slots("LOUPE_TEST_SLOTS") == 1


def test_concurrency_slots_reads_the_env(monkeypatch):
    monkeypatch.setenv("LOUPE_TEST_SLOTS", "4")
    assert limits.concurrency_slots("LOUPE_TEST_SLOTS") == 4


def test_concurrency_slots_floors_zero_at_one(monkeypatch):
    """0 slots would deadlock every request — the bound is never below 1."""
    monkeypatch.setenv("LOUPE_TEST_SLOTS", "0")
    assert limits.concurrency_slots("LOUPE_TEST_SLOTS") == 1


def test_concurrency_slots_ignores_garbage(monkeypatch):
    monkeypatch.setenv("LOUPE_TEST_SLOTS", "-2")
    assert limits.concurrency_slots("LOUPE_TEST_SLOTS") == 1
    monkeypatch.setenv("LOUPE_TEST_SLOTS", "many")
    assert limits.concurrency_slots("LOUPE_TEST_SLOTS") == 1


def test_seconds_env_reads_the_variable(monkeypatch):
    monkeypatch.setenv("LOUPE_TEST_TIMEOUT", "120")
    assert limits.seconds_env("LOUPE_TEST_TIMEOUT", 900) == 120.0


def test_seconds_env_garbage_falls_back(monkeypatch):
    monkeypatch.setenv("LOUPE_TEST_TIMEOUT", "-5x")
    assert limits.seconds_env("LOUPE_TEST_TIMEOUT", 900) == 900.0


def test_seconds_env_zero_falls_back():
    """0 would make every stream time out instantly — never a valid timeout."""
    import os

    os.environ["LOUPE_TEST_TIMEOUT"] = "0"
    try:
        assert limits.seconds_env("LOUPE_TEST_TIMEOUT", 900) == 900.0
    finally:
        del os.environ["LOUPE_TEST_TIMEOUT"]
