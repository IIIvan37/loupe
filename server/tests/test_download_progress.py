"""Download progress fraction (torch-free, extracted from download.py).

Run: `.venv/bin/python -m pytest`.
"""

from __future__ import annotations

from app.download import progress_fraction


def test_fraction_from_total_bytes():
    assert (
        progress_fraction({"status": "downloading", "total_bytes": 200, "downloaded_bytes": 50})
        == 0.25
    )


def test_falls_back_to_estimate():
    assert (
        progress_fraction(
            {"status": "downloading", "total_bytes_estimate": 400, "downloaded_bytes": 100}
        )
        == 0.25
    )


def test_caps_at_one_when_overshooting():
    assert (
        progress_fraction({"status": "downloading", "total_bytes": 100, "downloaded_bytes": 150})
        == 1.0
    )


def test_none_when_not_downloading():
    assert progress_fraction({"status": "finished", "total_bytes": 100}) is None


def test_none_without_a_total():
    assert progress_fraction({"status": "downloading", "downloaded_bytes": 10}) is None


def test_none_when_total_is_zero():
    assert (
        progress_fraction({"status": "downloading", "total_bytes": 0, "downloaded_bytes": 0})
        is None
    )
