"""Unit tests for the pure analyse-token verifier (stdlib HS256, torch-free).

The minting helpers live in `analyze_token_kit` (shared with the gate suite);
they reproduce exactly what the Supabase Edge Function emits, so these tests
double as a contract pin between the two sides: change the signing recipe on
one side and these break.
"""

from __future__ import annotations

import json

import pytest
from analyze_token_kit import NOW, SECRET, b64url, mint, sign_segments, valid_claims

from app.analyze_auth import InvalidAnalyzeToken, verify_analyze_token


class TestVerifyAnalyzeToken:
    def test_accepts_a_valid_token_and_returns_its_claims(self) -> None:
        claims = verify_analyze_token(mint(valid_claims()), SECRET, now=NOW)
        assert claims["sub"] == "user-1"

    def test_accepts_right_up_to_but_not_at_expiry(self) -> None:
        token = mint(valid_claims(exp=NOW + 1))
        assert verify_analyze_token(token, SECRET, now=NOW)["sub"] == "user-1"
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(token, SECRET, now=NOW + 1)  # now == exp -> expired

    def test_rejects_a_wrong_secret(self) -> None:
        token = mint(valid_claims())
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(token, "another-secret", now=NOW)

    def test_rejects_a_tampered_payload(self) -> None:
        header, _, sig = mint(valid_claims()).split(".")
        forged_payload = b64url(json.dumps(valid_claims() | {"sub": "attacker"}).encode())
        forged = f"{header}.{forged_payload}.{sig}"
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(forged, SECRET, now=NOW)

    def test_rejects_the_alg_none_bypass(self) -> None:
        # A token that claims alg=none must never be trusted, signature or not.
        token = mint(valid_claims(), alg="none")
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(token, SECRET, now=NOW)

    def test_rejects_wrong_audience(self) -> None:
        token = mint(valid_claims() | {"aud": "someone-else"})
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(token, SECRET, now=NOW)

    def test_rejects_wrong_issuer(self) -> None:
        token = mint(valid_claims() | {"iss": "not-loupe"})
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(token, SECRET, now=NOW)

    def test_rejects_a_missing_expiry(self) -> None:
        claims = valid_claims()
        del claims["exp"]
        token = mint(claims)
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(token, SECRET, now=NOW)

    @pytest.mark.parametrize("token", ["", "a.b", "not-a-jwt", "a.b.c.d", "x.y.z"])
    def test_rejects_malformed_tokens(self, token: str) -> None:
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(token, SECRET, now=NOW)

    def test_rejects_a_non_json_header_even_when_correctly_signed(self) -> None:
        token = sign_segments(b64url(b"not json"), b64url(json.dumps(valid_claims()).encode()))
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(token, SECRET, now=NOW)

    def test_rejects_an_unreadable_payload_even_when_correctly_signed(self) -> None:
        header = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
        token = sign_segments(header, b64url(b"{not valid json"))
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(token, SECRET, now=NOW)

    def test_rejects_a_header_that_is_not_an_object(self) -> None:
        # A correctly signed token whose header is valid JSON but not an object
        # must raise InvalidAnalyzeToken, not leak an AttributeError (-> 500).
        token = sign_segments(b64url(b"[1]"), b64url(json.dumps(valid_claims()).encode()))
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(token, SECRET, now=NOW)

    def test_rejects_a_token_with_non_ascii_characters(self) -> None:
        # A non-ASCII payload segment behind a valid header must not leak a
        # UnicodeEncodeError from the ascii-encode of the signing input
        # (-> 500 in the middleware). Only the header is decoded before that.
        header = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(f"{header}.é.sig", SECRET, now=NOW)

    def test_rejects_a_payload_that_is_not_an_object(self) -> None:
        header = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
        token = sign_segments(header, b64url(b"123"))  # valid JSON, but a number
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(token, SECRET, now=NOW)

    def test_rejects_an_empty_secret(self) -> None:
        token = mint(valid_claims())
        with pytest.raises(InvalidAnalyzeToken):
            verify_analyze_token(token, "", now=NOW)
