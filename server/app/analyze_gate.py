"""The analyse-token gate: bearer auth middleware for the Modal endpoint.

Extracted from `modal_app.py` so the production auth path (bearer parsing,
OPTIONS bypass, 401 mapping) is importable WITHOUT torch or modal — and
therefore linted, type-checked and TestClient-tested like the rest of `app/`.
`modal_app.py` stays pure composition: it installs the gate, then adds
CORSMiddleware.

Ordering contract: install the gate BEFORE CORSMiddleware. Starlette's
`add_middleware` prepends, so the later CORS layer wraps the gate — the 401s
short-circuited here get their Access-Control-Allow-Origin (+ Vary: Origin)
from the real CORS middleware, and preflights are answered before the gate.
Pinned by `TestGateComposedWithCors`.
"""

from __future__ import annotations

import time
from collections.abc import Callable

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

from app.analyze_auth import InvalidAnalyzeToken, verify_analyze_token


def install_analyze_gate(
    app: FastAPI,
    *,
    secret: str,
    now: Callable[[], int] = lambda: int(time.time()),
) -> None:
    """Require a valid short-lived analyse token on every non-OPTIONS request.

    The client presents a token minted by the Supabase Edge Function, signed
    HS256 with the shared secret; `verify_analyze_token` does the checking.
    OPTIONS passes through untouched (CORS preflights carry no Authorization).
    `now` is injectable so expiry is deterministic under test.
    """

    @app.middleware("http")
    async def require_token(request: Request, call_next) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)
        header = request.headers.get("authorization", "")
        token = header[7:] if header.startswith("Bearer ") else ""
        try:
            verify_analyze_token(token, secret, now=now())
        except InvalidAnalyzeToken:
            return JSONResponse({"detail": "unauthorized"}, status_code=401)
        return await call_next(request)
