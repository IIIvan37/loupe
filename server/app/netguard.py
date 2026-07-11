"""Network trust boundary — refuse requests that aren't the local loupe app's.

Two independent guards, both pure predicates behind tiny ASGI middlewares
(torch-free, unit-testable):

- Loopback-only: `TrustedHostMiddleware` (the Host header, A.2) already blocks
  the common LAN case, but an operator who binds us to `0.0.0.0` and an
  attacker who forges `Host: localhost` would slip past it. This inspects the
  actual local socket address (ASGI `scope["server"]`), which for a `0.0.0.0`
  bind is the concrete interface IP the connection landed on — so a
  non-loopback hit is refused regardless of the Host header or the bind host.
- Origin guard (M.1): CORS stops a foreign page from *reading* us, not from
  *sending* — a "simple request" POST (`text/plain`) needs no preflight, so a
  third-party page could still trigger `/download`, `/audio`, the inference
  endpoints or `/gc`. Any request carrying an `Origin` header outside the
  allowlist is refused; requests without one (curl, native clients) are not
  browser-mediated CSRF and pass.
"""

from __future__ import annotations

import ipaddress
from collections.abc import Collection

from starlette.responses import PlainTextResponse
from starlette.types import ASGIApp, Receive, Scope, Send

_LOOPBACK_NAMES = {"localhost"}


def is_loopback_host(host: str | None) -> bool:
    """True iff `host` is the loopback name or a loopback IP (127/8, ::1)."""
    if not host:
        return False
    if host in _LOOPBACK_NAMES:
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


class LoopbackOnlyMiddleware:
    """Refuse (403) any HTTP request whose local server address isn't loopback."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            server = scope.get("server")
            host = server[0] if server else None
            if not is_loopback_host(host):
                response = PlainTextResponse("loopback only", status_code=403)
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)


def is_allowed_origin(origin: str | None, allowed: Collection[str]) -> bool:
    """True iff the request is not browser-mediated (no Origin) or the Origin
    is allowlisted. `null` (sandboxed iframe, file://) and `""` are foreign."""
    if origin is None:
        return True
    return origin in allowed


class OriginGuardMiddleware:
    """Refuse (403) any HTTP request bearing an Origin outside the allowlist."""

    def __init__(self, app: ASGIApp, allowed_origins: Collection[str]) -> None:
        self.app = app
        self.allowed_origins = frozenset(allowed_origins)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            headers = dict(scope.get("headers") or [])
            raw = headers.get(b"origin")
            origin = raw.decode("latin-1") if raw is not None else None
            if not is_allowed_origin(origin, self.allowed_origins):
                response = PlainTextResponse("origin not allowed", status_code=403)
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)
