"""Shared OpenAPI documentation for the HTTPExceptions the routes raise.

One vocabulary for the whole server: a route lists the status codes it can
answer with, and the schema names each one — so the generated OpenAPI tells
the error contract the adapters already rely on (N.1 discriminated codes).
"""

from __future__ import annotations

_DESCRIPTIONS: dict[int, str] = {
    400: "invalid or undecodable input",
    404: "unknown resource",
    413: "request body over the size cap",
    503: "capability unavailable on this host",
    504: "analysis timed out",
    507: "storage quota exceeded",
}


def error_responses(*codes: int) -> dict[int | str, dict[str, str]]:
    """The `responses=` documentation for a route's error statuses."""
    return {code: {"description": _DESCRIPTIONS[code]} for code in codes}
