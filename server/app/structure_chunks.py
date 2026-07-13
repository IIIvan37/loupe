"""Track duration -> structure-detection chunk plan: the decidable part of the
chunked inference loop.

Pure (torch/numpy-free) so it's unit-tested and type-checked, unlike its host
`structure.py` (which runs the vendored SongFormer stack). The reference
inference does a single SSL forward over the whole track, which OOMs the
machine's unified memory past ~4.5 min (measured). We instead process the track
in `chunk_s`-second windows, each read with a `overlap_s` context margin on both
sides so the model's start-of-input "intro" bias falls in a discarded margin
rather than on a real section boundary. This module owns that windowing
arithmetic; the torch shell slices the audio and keeps the segments whose centre
falls in each window's owned region (see `structure_segments`).
"""

from __future__ import annotations

import math
from typing import TypedDict


class ChunkWindow(TypedDict):
    # The region of the track this window is responsible for (its segments are
    # kept only if their centre falls in [own_start, own_end)).
    own_start: float
    own_end: float
    # The wider slice actually fed to the model: the owned region plus a context
    # margin on each side, clamped to the track.
    proc_start: float
    proc_end: float


# A window whose owned region is shorter than this is a rounding tail, not a
# section — too short to analyse, so it is dropped rather than sent to the model.
_MIN_OWNED_SECONDS = 1.0


def chunk_plan(duration: float, chunk_s: float, overlap_s: float) -> list[ChunkWindow]:
    """Tile `duration` seconds into owned windows of `chunk_s`, each processed
    with `overlap_s` of context on both sides (clamped to the track).

    The owned regions are contiguous and cover the whole track with no gap or
    overlap; the processed slices overlap by `overlap_s`. A sub-second owned
    tail is dropped. No duration plans no windows.
    """
    if chunk_s <= 0:
        raise ValueError("chunk_s must be positive")
    if overlap_s < 0:
        raise ValueError("overlap_s must be non-negative")
    if duration <= 0:
        return []
    windows: list[ChunkWindow] = []
    for c in range(math.ceil(duration / chunk_s)):
        own_start = c * chunk_s
        own_end = min((c + 1) * chunk_s, duration)
        if own_end - own_start < _MIN_OWNED_SECONDS:
            continue
        windows.append(
            {
                "own_start": own_start,
                "own_end": own_end,
                "proc_start": max(0.0, own_start - overlap_s),
                "proc_end": min(duration, own_end + overlap_s),
            }
        )
    return windows
