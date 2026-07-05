"""The app still serves when the optional ML/download stacks are absent.

`main` imports separation / tempo / download lazily and, on failure, registers a
contract-honouring fallback (NDJSON error / 503) instead of the real router. We
prove that invariant by importing a fresh `app.main` with those submodules forced
missing — which also keeps the test torch-free and fast (the heavy imports never
run). The original `app.main` object is preserved and restored so other tests are
unaffected. Run: `.venv/bin/python -m pytest`.
"""

from __future__ import annotations

import importlib
import sys

import pytest
from fastapi.testclient import TestClient

_OPTIONAL = ("app.separation", "app.tempo", "app.download")


@pytest.fixture
def app_without_ml():
    saved = {name: sys.modules.get(name) for name in (*_OPTIONAL, "app.main")}
    for name in _OPTIONAL:
        sys.modules[name] = None  # sentinel: `from .x import ...` raises ImportError
    sys.modules.pop("app.main", None)
    try:
        fresh = importlib.import_module("app.main")  # new module object, real one untouched
        yield fresh
    finally:
        for name, module in saved.items():
            if module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = module


def test_separate_fallback_is_ndjson_error(app_without_ml):
    client = TestClient(app_without_ml.app, base_url="http://localhost")
    res = client.post("/separate", content=b"")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/x-ndjson")
    assert "separation unavailable" in res.text


def test_tempo_fallback_is_503(app_without_ml):
    client = TestClient(app_without_ml.app, base_url="http://localhost")
    res = client.post("/tempo", content=b"")
    assert res.status_code == 503
    assert "tempo detection unavailable" in res.json()["detail"]


def test_download_fallback_is_ndjson_error(app_without_ml):
    client = TestClient(app_without_ml.app, base_url="http://localhost")
    res = client.post("/download", json={"url": "https://youtube.com/x"})
    assert res.status_code == 200
    assert "track download unavailable" in res.text


def test_health_reports_no_model_without_the_ml_stack(app_without_ml):
    client = TestClient(app_without_ml.app, base_url="http://localhost")
    assert client.get("/health").json() == {"status": "ok", "model": None, "device": None}


def test_startup_runs_the_boot_gc(app_without_ml, monkeypatch):
    """Entering the client context fires the lifespan → the boot-time GC sweep."""
    from app import main as main_mod

    swept = {"called": False}
    monkeypatch.setattr(main_mod, "collect_garbage", lambda: swept.__setitem__("called", True))
    with TestClient(app_without_ml.app, base_url="http://localhost") as client:
        assert client.get("/health").status_code == 200
    assert swept["called"] is True
