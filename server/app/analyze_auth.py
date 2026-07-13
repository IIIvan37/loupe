"""Verify the short-lived analyse token minted by the Supabase Edge Function.

Pure and dependency-free (stdlib `hmac`/`hashlib`/`base64`/`json`), so it is
unit-tested and type-checked like the other humble objects here — no PyJWT in
the Modal image. It implements exactly the slice of JWT we mint at J2.2: a
compact HS256 token with `{sub, aud, iss, iat, exp}`.

`verify_analyze_token` returns the claims on success and raises
`InvalidAnalyzeToken` on any failure (bad shape, unsupported alg, signature
mismatch, wrong audience/issuer, or expiry). The Modal middleware turns that
exception into a 401; it never trusts an unverified payload.

Contract (must match `supabase/functions/mint-analyze-token/index.ts`):
  alg = HS256, aud = "loupe-analyze", iss = "loupe-supabase", HMAC-SHA256 over
  the ASCII `header.payload`, secret = the shared `ANALYZE_JWT_SECRET`.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
from typing import Any

AUDIENCE = "loupe-analyze"
ISSUER = "loupe-supabase"


class InvalidAnalyzeToken(Exception):
    """The presented token is missing, malformed, or fails verification."""


def _b64url_decode(segment: str) -> bytes:
    # JWT uses base64url WITHOUT padding; restore it before decoding.
    padding = "=" * (-len(segment) % 4)
    try:
        return base64.urlsafe_b64decode(segment + padding)
    except (ValueError, TypeError) as exc:  # malformed base64
        raise InvalidAnalyzeToken("malformed token segment") from exc


def verify_analyze_token(
    token: str,
    secret: str,
    *,
    now: int,
    audience: str = AUDIENCE,
    issuer: str = ISSUER,
) -> dict[str, Any]:
    """Return the token's claims if it is a valid, unexpired HS256 token.

    `now` is the current UNIX time in seconds (injected, so the fold stays
    pure). Raises `InvalidAnalyzeToken` on any failure.
    """
    if not token or not secret:
        raise InvalidAnalyzeToken("missing token or secret")

    parts = token.split(".")
    if len(parts) != 3:
        raise InvalidAnalyzeToken("token must have three segments")
    header_b64, payload_b64, signature_b64 = parts

    try:
        header = json.loads(_b64url_decode(header_b64))
    except json.JSONDecodeError as exc:
        raise InvalidAnalyzeToken("unreadable header") from exc
    if header.get("alg") != "HS256":
        # Reject anything but HS256 — in particular "none", the classic bypass.
        raise InvalidAnalyzeToken("unsupported algorithm")

    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    expected = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    presented = _b64url_decode(signature_b64)
    if not hmac.compare_digest(expected, presented):
        raise InvalidAnalyzeToken("signature mismatch")

    try:
        claims = json.loads(_b64url_decode(payload_b64))
    except json.JSONDecodeError as exc:
        raise InvalidAnalyzeToken("unreadable payload") from exc
    if not isinstance(claims, dict):
        raise InvalidAnalyzeToken("payload is not an object")

    if claims.get("aud") != audience:
        raise InvalidAnalyzeToken("wrong audience")
    if claims.get("iss") != issuer:
        raise InvalidAnalyzeToken("wrong issuer")

    exp = claims.get("exp")
    if not isinstance(exp, int | float):
        raise InvalidAnalyzeToken("missing expiry")
    if now >= exp:
        raise InvalidAnalyzeToken("token expired")

    return claims
