"""Startup sweep of orphaned download temp dirs.

`/download` extracts into `tempfile.TemporaryDirectory(prefix="loupe-download-")`,
which cleans up per operation — but a SIGKILL mid-download leaves the directory
behind (same lesson as the Rust side, T2.3: per-op cleanup cannot cover a hard
kill). The lifespan sweep prunes leftovers, keeping a safety margin so a
concurrent instance's *live* download (another port, mid-extraction) is never
touched: only dirs older than the stale threshold go.
"""

from __future__ import annotations

import time
from pathlib import Path

from app.temp_sweep import STALE_AFTER_SECONDS, sweep_stale_downloads


def _orphan(tmp_path: Path, name: str, age_seconds: float) -> Path:
    orphan = tmp_path / name
    orphan.mkdir()
    (orphan / "partial.webm").write_bytes(b"x")
    stamp = time.time() - age_seconds
    # utime touches the dir itself; the sweep judges age by the dir mtime.
    import os

    os.utime(orphan, (stamp, stamp))
    return orphan


def test_prunes_stale_download_orphans(tmp_path: Path) -> None:
    stale = _orphan(tmp_path, "loupe-download-abc", STALE_AFTER_SECONDS + 60)
    sweep_stale_downloads(tmp_path)
    assert not stale.exists()


def test_spares_a_fresh_download_dir(tmp_path: Path) -> None:
    # A concurrent instance may be mid-download: fresh dirs are live, not orphans.
    fresh = _orphan(tmp_path, "loupe-download-def", age_seconds=5)
    sweep_stale_downloads(tmp_path)
    assert fresh.exists()


def test_ignores_foreign_entries(tmp_path: Path) -> None:
    foreign_dir = _orphan(tmp_path, "not-ours", STALE_AFTER_SECONDS + 60)
    foreign_file = tmp_path / "loupe-download-file"
    foreign_file.write_bytes(b"x")
    sweep_stale_downloads(tmp_path)
    assert foreign_dir.exists()
    assert foreign_file.exists()


def test_a_failing_removal_does_not_raise(tmp_path: Path, monkeypatch) -> None:
    _orphan(tmp_path, "loupe-download-ghi", STALE_AFTER_SECONDS + 60)
    import shutil

    def boom(*_args, **_kwargs):
        raise OSError("locked")

    monkeypatch.setattr(shutil, "rmtree", boom)
    sweep_stale_downloads(tmp_path)  # best-effort: must not raise
