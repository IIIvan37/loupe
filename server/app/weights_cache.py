"""Checksum-pinned model-weight cache — torch-free, so it's tested.

`torch.load` unpickles arbitrary objects, so a downloaded checkpoint is only
ever handed to it after its sha256 matches the pin recorded next to the URL
(the hash of the audited artifact). A mismatch deletes the file — a corrupted
or tampered download must retry cleanly, never linger half-trusted on disk.
The ML shells (e.g. `chords.py`) call this before loading; the network fetch
happens at most once per host, like Demucs' and beat_this' own weight caches.
"""

from __future__ import annotations

import hashlib
import logging
import urllib.request
from pathlib import Path

logger = logging.getLogger("loupe.weights")


class WeightsUnavailable(RuntimeError):
    """The pinned weights could not be fetched or verified.

    A distinct type so the ML shells can answer 503 (host not provisioned)
    instead of blaming the client's audio with a 400.
    """


def pinned_weights(url: str, sha256: str, target: Path) -> Path:
    """The weights at `target`, downloading from `url` if absent — verified.

    Always re-hashes the file (even a cache hit: the cache dir is plain user
    disk, not a trusted store) and raises `WeightsUnavailable` after deleting
    it when the digest doesn't match `sha256`.
    """
    if not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        logger.info("fetching model weights to %s", target)
        partial = target.with_suffix(".part")
        try:
            _fetch(url, partial)
        except OSError as exc:  # DNS failure, refused, idle timeout…
            raise WeightsUnavailable(f"could not fetch model weights: {exc}") from exc
        partial.rename(target)
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    if digest != sha256:
        target.unlink(missing_ok=True)
        raise WeightsUnavailable("model checkpoint failed its sha256 pin")
    return target


# Abort a download whose connection goes idle: the first request holds the ML
# shell's build lock while fetching, so a silent stall would otherwise wedge
# every later request behind it until a restart.
_IDLE_TIMEOUT_SECONDS = 30.0


def _fetch(url: str, destination: Path) -> None:
    """Stream `url` to `destination`, failing on an idle connection."""
    with (
        urllib.request.urlopen(url, timeout=_IDLE_TIMEOUT_SECONDS) as source,  # noqa: S310 - pinned https URL
        open(destination, "wb") as sink,
    ):
        while chunk := source.read(1 << 20):
            sink.write(chunk)
