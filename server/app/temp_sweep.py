"""Prune orphaned download temp dirs (distribution D2).

`/download` extracts into `tempfile.TemporaryDirectory(prefix="loupe-download-")`;
the context manager cleans up per operation, but a hard kill (SIGKILL, power
loss) mid-download leaves the directory behind — the same lesson the Rust
sidecar learned in T2.3. The boot-time sweep removes the leftovers.

Only *stale* dirs go: a concurrent loupe instance (another port) may be
mid-download, and its live temp dir must never be touched — the age margin is
far beyond any real extraction time. Best-effort like the audio GC: a failed
removal must not stop the server from serving.
"""

from __future__ import annotations

import contextlib
import shutil
import tempfile
import time
from pathlib import Path

_PREFIX = "loupe-download-"

# Far beyond any real extraction (minutes), far below "accumulating junk" (days).
STALE_AFTER_SECONDS = 60 * 60


def sweep_stale_downloads(tmp_root: Path | None = None) -> None:
    """Remove `loupe-download-*` dirs older than the stale threshold."""
    root = tmp_root if tmp_root is not None else Path(tempfile.gettempdir())
    cutoff = time.time() - STALE_AFTER_SECONDS
    with contextlib.suppress(OSError):
        for entry in root.iterdir():
            if not entry.name.startswith(_PREFIX) or not entry.is_dir():
                continue
            with contextlib.suppress(OSError):
                if entry.stat().st_mtime < cutoff:
                    with contextlib.suppress(OSError):
                        shutil.rmtree(entry)
