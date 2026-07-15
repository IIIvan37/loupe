"""Browser-origin allowlist, shared by every shell that fronts a browser.

ONE allowlist gates three surfaces in three languages: the local FastAPI
server (`app/main.py` — CORS + OriginGuard), the deployed Modal endpoint
(`modal_app.py` — CORS), and the Supabase Edge Function
(`supabase/functions/mint-analyze-token/index.ts`, which mirrors this parsing
in Deno). Each reads the SAME `LOUPE_ALLOWED_ORIGINS` env var (comma-separated)
from its own environment — the local shell, the `loupe-analyze-jwt` Modal
secret, `supabase secrets set` — and falls back to the dev origins below.
Adding an origin is an env change everywhere, never a code edit; the
cross-surface checklist lives in docs/j2-supabase-runbook.md.
"""

from __future__ import annotations

import os

DEFAULT_ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"


def env_list(name: str, default: str) -> list[str]:
    """Comma-separated env var → trimmed, non-empty entries (falls back to
    `default` only when the var is UNSET — set-but-empty means "no entries")."""
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


def allowed_origins() -> list[str]:
    """The origins allowed to call us from a browser.

    A literal `*` entry is dropped: CORSMiddleware would read it as
    wildcard-allow-all — on Modal there is no OriginGuard backstop, so a
    shortcut taken "to unblock an origin quickly" would CORS-open the deployed
    endpoint to every page. Refusing it fails CLOSED (empty list), which the
    operator notices immediately. (The Deno mirror is naturally inert to `*` —
    it compares the real Origin header against the set.)
    """
    return [
        origin
        for origin in env_list("LOUPE_ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS)
        if origin != "*"
    ]
