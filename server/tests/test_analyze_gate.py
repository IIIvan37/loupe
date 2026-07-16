"""TestClient tests for the analyse-token gate (the Modal auth middleware).

`install_analyze_gate` is the humble-object extraction of `modal_app.py`'s
`require_token` middleware: importable without torch/modal, so the production
auth path (bearer parsing, OPTIONS bypass, 401 mapping) is pinned here instead
of living outside every gate.

`_composed_client` mirrors modal_app.py's exact middleware composition (gate
installed BEFORE CORSMiddleware, so CORS is outermost) — that ordering is what
puts Access-Control-Allow-Origin on the gate's 401s; these tests pin it so a
reorder in modal_app.py fails here instead of silently masking 401s in the
browser as opaque CORS errors.
"""

from __future__ import annotations

import pytest
from analyze_token_kit import NOW, SECRET, b64url, mint, valid_claims
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from app.analyze_gate import install_analyze_gate

ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]


def _valid_token(exp: int = NOW + 300, *, secret: str = SECRET) -> str:
    return mint(valid_claims(exp), secret=secret)


def _app_with_probe() -> FastAPI:
    app = FastAPI()

    @app.post("/probe")
    def probe() -> dict:
        return {"ok": True}

    @app.get("/stems-probe")
    def stems_probe() -> dict:
        return {"ok": True}

    return app


def _gated_client() -> TestClient:
    app = _app_with_probe()
    install_analyze_gate(app, secret=SECRET, now=lambda: NOW)
    return TestClient(app)


def _composed_client() -> TestClient:
    """The gate composed with CORS exactly like modal_app.py: gate first,
    CORSMiddleware after — add_middleware prepends, so CORS is outermost and
    decorates the gate's 401s (and answers preflights before the gate)."""
    app = _app_with_probe()
    install_analyze_gate(app, secret=SECRET, now=lambda: NOW)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )
    return TestClient(app)


class TestSecretFloor:
    def test_installing_with_a_short_secret_fails_loudly(self) -> None:
        # A weak shared secret must abort at startup, not silently guard prod.
        with pytest.raises(ValueError, match="32"):
            install_analyze_gate(FastAPI(), secret="too-short")

    def test_installing_with_an_empty_secret_fails_loudly(self) -> None:
        with pytest.raises(ValueError, match="32"):
            install_analyze_gate(FastAPI(), secret="")


class TestAnalyzeGate:
    def test_lets_a_valid_bearer_token_through(self) -> None:
        response = _gated_client().post(
            "/probe", headers={"Authorization": f"Bearer {_valid_token()}"}
        )
        assert response.status_code == 200
        assert response.json() == {"ok": True}

    def test_rejects_a_missing_authorization_header(self) -> None:
        response = _gated_client().post("/probe")
        assert response.status_code == 401
        assert response.json() == {"detail": "unauthorized"}

    def test_rejects_a_non_bearer_authorization_header(self) -> None:
        response = _gated_client().post(
            "/probe", headers={"Authorization": f"Basic {_valid_token()}"}
        )
        assert response.status_code == 401

    def test_rejects_a_token_signed_with_another_secret(self) -> None:
        forged = _valid_token(secret="attacker-controlled-secret-32-chars!!")
        response = _gated_client().post("/probe", headers={"Authorization": f"Bearer {forged}"})
        assert response.status_code == 401

    def test_rejects_an_expired_token(self) -> None:
        response = _gated_client().post(
            "/probe", headers={"Authorization": f"Bearer {_valid_token(exp=NOW)}"}
        )
        assert response.status_code == 401

    def test_a_malformed_token_maps_to_401_not_500(self) -> None:
        # Attacker-controlled garbage must never escape as an unhandled error.
        garbage = f"{b64url(b'[1]')}.{b64url(b'x')}.sig"
        response = _gated_client().post("/probe", headers={"Authorization": f"Bearer {garbage}"})
        assert response.status_code == 401

    def test_gates_get_requests_too(self) -> None:
        # M1.3: the stem downloads (GET /stems/...) sit behind the same gate —
        # a WAV must never be fetchable without the analyse token.
        assert _gated_client().get("/stems-probe").status_code == 401
        response = _gated_client().get(
            "/stems-probe", headers={"Authorization": f"Bearer {_valid_token()}"}
        )
        assert response.status_code == 200

    def test_options_bypasses_the_gate(self) -> None:
        # CORS preflights carry no Authorization header; the gate must let them
        # reach the CORS layer instead of 401-ing them. Without a CORS middleware
        # here FastAPI answers 405 — the point is it is NOT the gate's 401.
        response = _gated_client().options("/probe")
        assert response.status_code != 401


class TestGateComposedWithCors:
    def test_401_carries_the_allow_origin_for_an_allowlisted_origin(self) -> None:
        # The outermost CORS layer must decorate the gate's 401 — otherwise the
        # browser masks it as an opaque CORS error instead of a readable 401.
        response = _composed_client().post("/probe", headers={"Origin": ALLOWED_ORIGINS[0]})
        assert response.status_code == 401
        assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGINS[0]
        assert "origin" in response.headers.get("vary", "").lower()

    def test_401_gets_no_allow_origin_for_a_foreign_origin(self) -> None:
        response = _composed_client().post("/probe", headers={"Origin": "https://evil.example"})
        assert response.status_code == 401
        assert "access-control-allow-origin" not in response.headers

    def test_preflight_is_answered_without_a_token(self) -> None:
        response = _composed_client().options(
            "/probe",
            headers={
                "Origin": ALLOWED_ORIGINS[0],
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGINS[0]

    def test_a_valid_cross_origin_request_passes_with_cors_headers(self) -> None:
        response = _composed_client().post(
            "/probe",
            headers={
                "Origin": ALLOWED_ORIGINS[0],
                "Authorization": f"Bearer {_valid_token()}",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGINS[0]
