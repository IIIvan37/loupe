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
