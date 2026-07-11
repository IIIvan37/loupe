"""Origin guard: CSRF "simple request" hardening.

CORS stops a foreign page from *reading* our responses, but not from *sending*:
a third-party page can POST `text/plain` to 127.0.0.1:8000 (TrustedHost passes,
the body readers ignore Content-Type) and trigger `/download`, `/audio`, the
inference endpoints or `/gc`. The guard refuses (403) any request that carries
an `Origin` header outside the allowlist; requests without an Origin header
(curl, native clients) pass — they are not browser-mediated CSRF.

Torch-free (imports only `app.netguard` + the FastAPI shell). Run from the
server root: `.venv/bin/python -m pytest`.
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.netguard import OriginGuardMiddleware, is_allowed_origin

ALLOWED = frozenset({"http://localhost:5173", "http://127.0.0.1:5173"})


@pytest.mark.parametrize("origin", ["http://localhost:5173", "http://127.0.0.1:5173"])
def test_allowed_origins_pass(origin):
    assert is_allowed_origin(origin, ALLOWED) is True


def test_absent_origin_passes():
    """No Origin header = not a browser-mediated request = not CSRF."""
    assert is_allowed_origin(None, ALLOWED) is True


@pytest.mark.parametrize("origin", ["https://evil.example", "null", ""])
def test_foreign_origins_are_rejected(origin):
    assert is_allowed_origin(origin, ALLOWED) is False


def _drive(headers):
    """Run the middleware over a fabricated http scope; return (app_called, status)."""
    calls = {"app": False, "status": None}

    async def downstream(scope, receive, send):
        calls["app"] = True

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        if message["type"] == "http.response.start":
            calls["status"] = message["status"]

    scope = {"type": "http", "headers": headers, "method": "POST", "path": "/gc"}
    middleware = OriginGuardMiddleware(downstream, allowed_origins=ALLOWED)
    asyncio.run(middleware(scope, receive, send))
    return calls


def test_middleware_passes_the_dev_origin_through():
    calls = _drive([(b"origin", b"http://localhost:5173")])
    assert calls["app"] is True


def test_middleware_passes_originless_requests_through():
    calls = _drive([])
    assert calls["app"] is True


def test_middleware_refuses_a_foreign_origin():
    calls = _drive([(b"origin", b"https://evil.example")])
    assert calls["app"] is False
    assert calls["status"] == 403


# End-to-end through the app: the exact CSRF vectors the roadmap names.
client = TestClient(app, base_url="http://localhost")

EVIL_ORIGIN = "https://evil.example"


def test_post_gc_with_foreign_origin_is_403():
    res = client.post("/gc", headers={"origin": EVIL_ORIGIN})
    assert res.status_code == 403


def test_post_download_with_foreign_origin_is_403():
    res = client.post("/download", headers={"origin": EVIL_ORIGIN}, content=b"{}")
    assert res.status_code == 403


def test_post_gc_with_dev_origin_is_not_blocked():
    res = client.post("/gc", headers={"origin": "http://localhost:5173"})
    assert res.status_code != 403
