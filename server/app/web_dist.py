"""Where the served web app lives (distribution D1/D3).

Three layouts, one priority order: the `LOUPE_WEB_DIST` env override wins
(operator's word), then the dist the wheel packaged next to this module
(`app/web_dist/`, D3), then the monorepo's build output (dev fallback).
"""

from __future__ import annotations

from pathlib import Path


def resolve_web_dist(env_value: str | None, packaged: Path, repo: Path) -> Path:
    if env_value:
        return Path(env_value)
    if (packaged / "index.html").is_file():
        return packaged
    return repo
