"""Stem store: private dirs, path validation, age-based cleanup.

Torch-free (the point of splitting `stems_store` out of `separation`), so these
run without the ML stack. The fixture repoints `JOBS_DIR` at a tmp path.
Run from the server root: `.venv/bin/python -m pytest`.
"""

from __future__ import annotations

import stat

import pytest

from app import stems_store


@pytest.fixture
def jobs(tmp_path, monkeypatch):
    root = tmp_path / "loupe-stems"
    monkeypatch.setattr(stems_store, "JOBS_DIR", root)
    return root


JOB = "0" * 32  # uuid4().hex shape


def test_ensure_and_new_job_dir_are_private(jobs):
    stems_store.ensure_jobs_dir()
    assert oct(stat.S_IMODE(jobs.stat().st_mode)) == oct(0o700)
    job_dir = stems_store.new_job_dir(JOB)
    assert oct(stat.S_IMODE(job_dir.stat().st_mode)) == oct(0o700)


def test_resolve_returns_path_for_existing_stem(jobs):
    job_dir = stems_store.new_job_dir(JOB)
    (job_dir / "voix.wav").write_bytes(b"RIFF")
    assert stems_store.resolve_stem_path(JOB, "voix") == job_dir / "voix.wav"


def test_resolve_none_for_missing_stem(jobs):
    stems_store.new_job_dir(JOB)
    assert stems_store.resolve_stem_path(JOB, "voix") is None


@pytest.mark.parametrize(
    ("job", "stem"),
    [
        ("../../etc", "voix"),  # traversal in job
        (JOB, "../secret"),  # traversal in stem
        ("not-hex-32", "voix"),  # wrong job shape
        (JOB, "Voix"),  # uppercase not allowed
        (JOB, "voix1"),  # digits not allowed
    ],
)
def test_resolve_rejects_malformed_segments(jobs, job, stem):
    assert stems_store.resolve_stem_path(job, stem) is None


def test_sweep_removes_only_dirs_past_ttl(jobs):
    now = 1_000_000.0
    old = stems_store.new_job_dir("a" * 32)
    fresh = stems_store.new_job_dir("b" * 32)
    import os

    os.utime(old, (now - 10_000, now - 10_000))
    os.utime(fresh, (now - 60, now - 60))

    removed = stems_store.sweep_old_jobs(now, ttl_seconds=3600)

    assert removed == 1
    assert not old.exists()
    assert fresh.exists()


def test_sweep_on_missing_root_is_noop(jobs):
    assert stems_store.sweep_old_jobs(1_000_000.0) == 0
