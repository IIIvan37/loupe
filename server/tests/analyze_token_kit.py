"""Shared JWT-minting helpers for the analyse-token test suites.

`mint` reproduces exactly what the Supabase Edge Function emits, so it is the
single contract pin between the two sides: change the signing recipe on one
side and every suite importing this kit breaks together (instead of a stale
copy silently pinning an obsolete recipe).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
from typing import Any

from app.analyze_auth import AUDIENCE, ISSUER

SECRET = "local-dev-analyze-secret-at-least-32-chars-long"
NOW = 1_000_000


def b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def mint(claims: dict[str, Any], *, secret: str = SECRET, alg: str = "HS256") -> str:
    header = b64url(json.dumps({"alg": alg, "typ": "JWT"}).encode())
    payload = b64url(json.dumps(claims).encode())
    return sign_segments(header, payload, secret=secret)


def sign_segments(header_b64: str, payload_b64: str, *, secret: str = SECRET) -> str:
    """Sign arbitrary (possibly malformed) header/payload segments correctly, so
    a test can reach the parsing branches that sit AFTER signature check."""
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    signature = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{b64url(signature)}"


def valid_claims(exp: int = NOW + 300) -> dict[str, Any]:
    return {"sub": "user-1", "aud": AUDIENCE, "iss": ISSUER, "iat": NOW, "exp": exp}
