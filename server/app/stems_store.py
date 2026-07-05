"""On-disk store for separated stems — path validation + age-based cleanup.

Kept out of `separation.py` (which loads the Demucs model on import) so this
pure path/TTL logic is testable without the ML stack, and reused by the `/stems`
handler. Stems live under a **private** temp dir (`0700`, so other local users
on a shared `/tmp` can't read a user's separated tracks) and are swept by age so
a long-running server doesn't accumulate WAVs unbounded.
"""

from __future__ import annotations

import os
import re
import shutil
import tempfile
from pathlib import Path

JOBS_DIR = Path(tempfile.gettempdir()) / "loupe-stems"

# job = `uuid4().hex`; stem = a lowercase-alpha id (voix, batterie, …). Both gate
# what may appear in the served path — defence in depth over Starlette's
# per-segment routing (no `:path` converter, so a '/' never reaches these).
_JOB_PATTERN = re.compile(r"^[0-9a-f]{32}$")
_STEM_PATTERN = re.compile(r"^[a-z]+$")

_ttl_raw = os.environ.get("LOUPE_STEMS_TTL_SECONDS", "3600")
STEMS_TTL_SECONDS = int(_ttl_raw) if _ttl_raw.isdigit() else 3600


def ensure_jobs_dir() -> Path:
    """Create the jobs root private to the current user (0700)."""
    JOBS_DIR.mkdir(parents=True, exist_ok=True)
    os.chmod(JOBS_DIR, 0o700)
    return JOBS_DIR


def new_job_dir(job: str) -> Path:
    """Create a fresh, private per-job directory."""
    job_dir = JOBS_DIR / job
    job_dir.mkdir(parents=True, exist_ok=True)
    os.chmod(job_dir, 0o700)
    return job_dir


def resolve_stem_path(job: str, stem: str) -> Path | None:
    """The WAV path for (job, stem) if both are well-formed and it exists, else None."""
    if not _JOB_PATTERN.match(job) or not _STEM_PATTERN.match(stem):
        return None
    path = JOBS_DIR / job / f"{stem}.wav"
    return path if path.is_file() else None


def sweep_old_jobs(now: float, ttl_seconds: int | None = None) -> int:
    """Remove job dirs whose mtime is older than the TTL. Returns the count removed."""
    ttl = STEMS_TTL_SECONDS if ttl_seconds is None else ttl_seconds
    if not JOBS_DIR.is_dir():
        return 0
    removed = 0
    for path in JOBS_DIR.iterdir():
        if not path.is_dir():
            continue
        try:
            age = now - path.stat().st_mtime
        except OSError:
            continue
        if age > ttl:
            shutil.rmtree(path, ignore_errors=True)
            removed += 1
    return removed
