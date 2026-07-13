"""Unit tests for the pure analyse-token verifier (stdlib HS256, torch-free).

The `_mint` helper reproduces exactly what the Supabase Edge Function emits, so
these tests double as a contract pin between the two sides: change the signing
recipe on one side and these break.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
from typing import Any

import pytest

from app.analyze_auth import (
    AUDIENCE,
    ISSUER,
    InvalidAnalyzeToken,
    verify_analyze_token,
)

SECRET = "local-dev-analyze-secret-at-least-32-chars-long"
NOW = 1_000_000


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _mint(
    claims: dict[str, Any],
    *,
    secret: str = SECRET,
    alg: str = "HS256",
) -> str:
    header = _b64url(json.dumps({"alg": alg, "typ": "JWT"}).encode())
    payload = _b64url(json.dumps(claims).encode())
    signing_input = f"{header}.{payload}".encode("ascii")
    signature = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    return f"{header}.{payload}.{_b64url(signature)}"


def _sign_segments(header_b64: str, payload_b64: str, *, secret: str = SECRET) -> str:
    """Sign arbitrary (possibly malformed) header/payload segments correctly, so
    a test can reach the parsing branches that sit AFTER signature check."""
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    signature = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_b64url(signature)}"


def _valid_claims(exp: int = NOW + 300) -> dict[str, Any]:
    return {"sub": "user-1", "aud": AUDIENCE, "iss": ISSUER, "iat": NOW, "exp": exp}


class TestVerifyAnalyzeToken:
    def test_accepts_a_valid_token_and_returns_its_claims(self) -> None:
        claims = verify_analyze_token(_mint(_valid_claims()), SECRET, now=NOW)
        assert claims["sub"] == "user-1"

    def test_accepts_right_up_to_but_not_at_expiry(self) -> None:
        token = _mint(_valid_claims(exp=NOW + 1))
        assert verify_analyze_token(token, SECRET, now=NOW)["sub"] == "user-1"
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(token, SECRET, now=NOW + 1)  # now == exp -> expired

    def test_rejects_a_wrong_secret(self) -> None:
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(_mint(_valid_claims()), "another-secret", now=NOW)

    def test_rejects_a_tampered_payload(self) -> None:
        header, _, sig = _mint(_valid_claims()).split(".")
        forged_payload = _b64url(json.dumps(_valid_claims() | {"sub": "attacker"}).encode())
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(f"{header}.{forged_payload}.{sig}", SECRET, now=NOW)

    def test_rejects_the_alg_none_bypass(self) -> None:
        # A token that claims alg=none must never be trusted, signature or not.
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(_mint(_valid_claims(), alg="none"), SECRET, now=NOW)

    def test_rejects_wrong_audience(self) -> None:
        claims = _valid_claims() | {"aud": "someone-else"}
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(_mint(claims), SECRET, now=NOW)

    def test_rejects_wrong_issuer(self) -> None:
        claims = _valid_claims() | {"iss": "not-loupe"}
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(_mint(claims), SECRET, now=NOW)

    def test_rejects_a_missing_expiry(self) -> None:
        claims = _valid_claims()
        del claims["exp"]
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(_mint(claims), SECRET, now=NOW)

    @pytest.mark.parametrize("token", ["", "a.b", "not-a-jwt", "a.b.c.d", "x.y.z"])
    def test_rejects_malformed_tokens(self, token: str) -> None:
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(token, SECRET, now=NOW)

    def test_rejects_a_non_json_header_even_when_correctly_signed(self) -> None:
        token = _sign_segments(_b64url(b"not json"), _b64url(json.dumps(_valid_claims()).encode()))
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(token, SECRET, now=NOW)

    def test_rejects_an_unreadable_payload_even_when_correctly_signed(self) -> None:
        header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
        token = _sign_segments(header, _b64url(b"{not valid json"))
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(token, SECRET, now=NOW)

    def test_rejects_a_payload_that_is_not_an_object(self) -> None:
        header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
        token = _sign_segments(header, _b64url(b"123"))  # valid JSON, but a number
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(token, SECRET, now=NOW)

    def test_rejects_an_empty_secret(self) -> None:
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(_mint(_valid_claims()), "", now=NOW)
