"""The server serves the built web app (distribution D1).

`main` mounts the web dist (env `LOUPE_WEB_DIST`) at `/` when the directory
exists — the local server becomes the app's own origin, so the HTTP adapters
talk same-origin. The mount must never shadow the API routes, and a host
without a built dist (dev, CI) must keep serving the API unchanged. Uses the
fresh-import fixture pattern of `test_main_fallbacks` (ML stacks forced
missing so the import stays torch-free and fast).
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

_OPTIONAL = ("app.separation", "app.tempo", "app.chords", "app.structure", "app.download")


@pytest.fixture
def fresh_main(monkeypatch: pytest.MonkeyPatch):
    """Yield a factory importing a fresh `app.main` under the current env."""
    saved = {name: sys.modules.get(name) for name in (*_OPTIONAL, "app.main")}

    def build():
        for name in _OPTIONAL:
            sys.modules[name] = None  # sentinel: `from .x import ...` raises
        sys.modules.pop("app.main", None)
        return importlib.import_module("app.main")

    try:
        yield build
    finally:
        for name, module in saved.items():
            if module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = module


def _dist(tmp_path: Path) -> Path:
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<!doctype html><title>loupe</title>")
    return dist


def test_serves_the_web_dist_at_the_root(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, fresh_main
) -> None:
    monkeypatch.setenv("LOUPE_WEB_DIST", str(_dist(tmp_path)))
    client = TestClient(fresh_main().app, base_url="http://localhost")
    res = client.get("/")
    assert res.status_code == 200
    assert "loupe" in res.text


def test_api_routes_win_over_the_static_mount(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, fresh_main
) -> None:
    monkeypatch.setenv("LOUPE_WEB_DIST", str(_dist(tmp_path)))
    client = TestClient(fresh_main().app, base_url="http://localhost")
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_without_a_dist_the_api_still_serves(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, fresh_main
) -> None:
    monkeypatch.setenv("LOUPE_WEB_DIST", str(tmp_path / "absent"))
    client = TestClient(fresh_main().app, base_url="http://localhost")
    assert client.get("/").status_code == 404
    assert client.get("/health").status_code == 200
