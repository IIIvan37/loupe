"""Unit tests for the checksum-pinned weight cache (torch-free)."""

from __future__ import annotations

import hashlib

import pytest

from app import weights_cache
from app.weights_cache import WeightsUnavailable, pinned_weights

_BYTES = b"model weights"
_SHA = hashlib.sha256(_BYTES).hexdigest()


def _fake_fetch(payload: bytes):
    def fetch(url: str, destination) -> None:
        with open(destination, "wb") as handle:
            handle.write(payload)

    return fetch


class TestPinnedWeights:
    def test_downloads_then_returns_the_verified_file(self, tmp_path, monkeypatch) -> None:
        monkeypatch.setattr(weights_cache, "_fetch", _fake_fetch(_BYTES))
        target = tmp_path / "cache" / "model.pt"
        assert pinned_weights("https://example/x.pt", _SHA, target) == target
        assert target.read_bytes() == _BYTES

    def test_a_cache_hit_skips_the_network(self, tmp_path, monkeypatch) -> None:
        def boom(url, destination) -> None:
            raise AssertionError("network must not be touched on a cache hit")

        monkeypatch.setattr(weights_cache, "_fetch", boom)
        target = tmp_path / "model.pt"
        target.write_bytes(_BYTES)
        assert pinned_weights("https://example/x.pt", _SHA, target) == target

    def test_a_bad_digest_deletes_the_file_and_raises(self, tmp_path, monkeypatch) -> None:
        monkeypatch.setattr(weights_cache, "_fetch", _fake_fetch(b"tampered"))
        target = tmp_path / "model.pt"
        with pytest.raises(WeightsUnavailable, match="sha256"):
            pinned_weights("https://example/x.pt", _SHA, target)
        assert not target.exists()

    def test_a_tampered_cache_hit_is_refused_too(self, tmp_path, monkeypatch) -> None:
        # The cache dir is plain user disk — a hit is re-hashed every time.
        monkeypatch.setattr(weights_cache, "_fetch", _fake_fetch(_BYTES))
        target = tmp_path / "model.pt"
        target.write_bytes(b"tampered")
        with pytest.raises(WeightsUnavailable, match="sha256"):
            pinned_weights("https://example/x.pt", _SHA, target)
        assert not target.exists()

    def test_a_failed_download_reads_as_weights_unavailable(self, tmp_path, monkeypatch) -> None:
        # OSError (DNS, refused, idle timeout) folds into the type the shell
        # maps to a 503 — and the target never appears, only the .part file.
        def dies(url, destination) -> None:
            with open(destination, "wb") as handle:
                handle.write(b"partial")
            raise OSError("connection reset")

        monkeypatch.setattr(weights_cache, "_fetch", dies)
        target = tmp_path / "model.pt"
        with pytest.raises(WeightsUnavailable, match="connection reset"):
            pinned_weights("https://example/x.pt", _SHA, target)
        assert not target.exists()
