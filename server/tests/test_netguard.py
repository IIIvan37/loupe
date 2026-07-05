"""Loopback-only guard: predicate + ASGI middleware.

Torch-free (imports only `app.netguard`), so it runs without the ML stack. The
middleware is driven directly with a fabricated ASGI scope — no HTTP server —
which also decouples it from the Host-header check so we can exercise the
reject path in isolation. Run from the server root: `.venv/bin/python -m pytest`.
"""

from __future__ import annotations

import asyncio

import pytest

from app.netguard import LoopbackOnlyMiddleware, is_loopback_host


@pytest.mark.parametrize("host", ["127.0.0.1", "127.5.6.7", "::1", "localhost"])
def test_loopback_hosts_are_accepted(host):
    assert is_loopback_host(host) is True


@pytest.mark.parametrize("host", ["0.0.0.0", "192.168.1.10", "8.8.8.8", "example.com", "", None])
def test_non_loopback_hosts_are_rejected(host):
    assert is_loopback_host(host) is False


def _drive(server):
    """Run the middleware over a fabricated http scope; return (app_called, status)."""
    calls = {"app": False, "status": None}

    async def downstream(scope, receive, send):
        calls["app"] = True

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        if message["type"] == "http.response.start":
            calls["status"] = message["status"]

    scope = {"type": "http", "server": server, "headers": [], "method": "GET", "path": "/"}
    asyncio.run(LoopbackOnlyMiddleware(downstream)(scope, receive, send))
    return calls


def test_middleware_passes_loopback_through():
    calls = _drive(("127.0.0.1", 8000))
    assert calls["app"] is True


def test_middleware_refuses_non_loopback():
    calls = _drive(("192.168.1.10", 8000))
    assert calls["app"] is False
    assert calls["status"] == 403


def test_middleware_refuses_when_server_absent():
    calls = _drive(None)
    assert calls["app"] is False
    assert calls["status"] == 403
