"""Loopback-only enforcement — refuse any request that didn't arrive over the
local loopback interface.

`TrustedHostMiddleware` (the Host header, A.2) already blocks the common LAN case,
but an operator who binds us to `0.0.0.0` and an attacker who forges
`Host: localhost` would slip past it. This inspects the actual local socket
address (ASGI `scope["server"]`), which for a `0.0.0.0` bind is the concrete
interface IP the connection landed on — so a non-loopback hit is refused
regardless of the Host header or the bind host. Pure `is_loopback_host` +
a tiny ASGI middleware, both torch-free and unit-testable.
"""

from __future__ import annotations

import ipaddress

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
