"""The server trusts only the local loupe web app.

Two guards, both env-overridable but locked to loopback by default:
- CORS scoped to the dev origin (never `*`), so a random page in the same
  browser cannot read our responses.
- Host-header validation (TrustedHostMiddleware), so DNS-rebinding cannot reach
  us over loopback despite CORS.

Run from the server root: `.venv/bin/python -m pytest`.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import _env_list, app

# Host header must be an allowed host, else TrustedHostMiddleware 400s every call.
client = TestClient(app, base_url="http://localhost")

DEV_ORIGIN = "http://localhost:5173"
EVIL_ORIGIN = "http://evil.example"


def test_health_ok_from_allowed_host():
    assert client.get("/health").status_code == 200


def test_rebinding_host_is_rejected():
    """A request whose Host isn't in the allowlist is refused before routing."""
    res = client.get("/health", headers={"host": "attacker.example"})
    assert res.status_code == 400


def test_cors_allows_the_dev_origin():
    res = client.get("/health", headers={"origin": DEV_ORIGIN})
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == DEV_ORIGIN


def test_cors_does_not_echo_a_foreign_origin():
    """A cross-origin page gets no allow-origin header, so it can't read us."""
    res = client.get("/health", headers={"origin": EVIL_ORIGIN})
    assert res.headers.get("access-control-allow-origin") != EVIL_ORIGIN
    assert res.headers.get("access-control-allow-origin") != "*"


def test_cors_preflight_rejects_foreign_origin():
    res = client.options(
        "/projects",
        headers={
            "origin": EVIL_ORIGIN,
            "access-control-request-method": "GET",
        },
    )
    assert res.headers.get("access-control-allow-origin") != EVIL_ORIGIN


def test_env_list_trims_and_drops_blanks(monkeypatch):
    monkeypatch.setenv("LOUPE_TEST_ORIGINS", " a , ,b ")
    assert _env_list("LOUPE_TEST_ORIGINS", "x") == ["a", "b"]
    monkeypatch.delenv("LOUPE_TEST_ORIGINS", raising=False)
    assert _env_list("LOUPE_TEST_ORIGINS", "d1,d2") == ["d1", "d2"]
