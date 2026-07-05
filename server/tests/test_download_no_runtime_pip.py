"""A download failure must NOT trigger a runtime `pip install`.

Auto-upgrading yt-dlp on the request path pulled the latest build from PyPI and
reloaded it in-process — remote code fetched over the network and executed,
attacker-triggerable via any failing download. These tests lock the invariant:
a stale/broken extraction surfaces a clear operator-facing message and installs
nothing. Run from the server root:

    .venv/bin/python -m pytest
"""

from __future__ import annotations

import queue

import pytest
import yt_dlp

from app import download


def test_download_error_surfaces_message_without_installing(monkeypatch):
    """A DownloadError yields an actionable error, never a subprocess/pip call."""

    def boom(url, out_dir, on_progress):
        raise yt_dlp.utils.DownloadError("player changed")

    monkeypatch.setattr(download, "_extract", boom)

    events: queue.Queue = queue.Queue()
    download._download("https://youtube.com/watch?v=x", None, events)

    kind, payload = events.get_nowait()
    assert kind == "error"
    assert "pip install -U yt-dlp" in payload
    assert events.empty()


def test_no_runtime_upgrade_helper_exists():
    """Regression guard: the request-path self-upgrade must stay deleted."""
    assert not hasattr(download, "_upgrade_yt_dlp")
    assert not hasattr(download, "subprocess")


@pytest.mark.parametrize(
    "url",
    [
        "https://www.youtube.com/watch?v=abc",
        "https://youtu.be/abc",
        "https://soundcloud.com/artist/track",
    ],
)
def test_supported_hosts_accepted(url):
    assert download._is_supported(url) is True


@pytest.mark.parametrize(
    "url",
    [
        "https://youtube.com.evil.com/watch?v=abc",  # suffix spoof
        "https://evil-youtube.com/watch?v=abc",
        "ftp://youtube.com/x",  # non-http scheme
        "not a url",
    ],
)
def test_unsupported_urls_rejected(url):
    assert download._is_supported(url) is False
