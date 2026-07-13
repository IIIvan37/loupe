"""Per-chunk segments -> one stitched section list: the decidable part of
structure detection.

Pure (torch/numpy-free) so it's unit-tested and type-checked, unlike its host
`structure.py` (which runs the vendored SongFormer stack). The model is run
window by window (see `structure_chunks`); each window reports section segments
relative to its processed slice. This module folds those into one track-wide
list: offset each segment to absolute time, keep only the segments a window
OWNS (centre inside its owned region, so the model's start-of-chunk "intro"
bias in the margin is dropped), merge same-label sections across a seam, and
close the small holes ownership-trimming leaves so the timeline is contiguous.
Times are raw seconds; snapping section boundaries to the beat grid is the pure
core's job (it needs the downbeats), mirroring how `/chords` ships raw spans.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import TypedDict

from .structure_chunks import ChunkWindow


class Segment(TypedDict):
    start: float
    end: float
    label: str


# Two owned segments whose seam sits within this many seconds are treated as
# touching (float offsets never land exactly equal across chunks).
_SEAM_TOLERANCE_SECONDS = 1.5


def stitch_segments(
    chunks: Sequence[tuple[ChunkWindow, Sequence[Segment]]],
    duration: float,
) -> list[Segment]:
    """Fold each window's slice-relative segments into one contiguous, absolute
    section list.

    Per window: shift every segment by `proc_start`, clamp to the track, and
    keep it only if its centre falls in the window's owned region (so the
    parasitic "intro" the model emits at a chunk's start — living in the left
    margin — is discarded). Across windows: merge adjacent same-label sections
    (a section split by a seam) and extend each section to the next one's start
    so no hole remains.
    """
    owned: list[Segment] = []
    for window, segments in chunks:
        own_start, own_end = window["own_start"], window["own_end"]
        offset = window["proc_start"]
        for seg in segments:
            start = float(seg["start"]) + offset
            end = min(float(seg["end"]) + offset, duration)
            if end <= start:
                continue
            if own_start <= (start + end) / 2 < own_end:
                owned.append(
                    {
                        "start": max(start, own_start),
                        "end": min(end, own_end),
                        "label": seg["label"],
                    }
                )

    merged: list[Segment] = []
    for seg in owned:
        if (
            merged
            and seg["label"] == merged[-1]["label"]
            and abs(seg["start"] - merged[-1]["end"]) < _SEAM_TOLERANCE_SECONDS
        ):
            merged[-1]["end"] = seg["end"]
        else:
            merged.append({"start": seg["start"], "end": seg["end"], "label": seg["label"]})

    # Close the seam holes ownership-trimming leaves so the interior is
    # back-to-back: each section extends to the next one's start. The head
    # and tail are NOT anchored here — a sub-second owned tail that
    # `chunk_plan` dropped leaves the last section ending before `duration`;
    # anchoring the first boundary to 0 and the last to the track end is the
    # pure core's job (it snaps boundaries to the beat grid, and has the
    # measured first=0 / last=duration rules).
    for i in range(len(merged) - 1):
        merged[i]["end"] = merged[i + 1]["start"]
    return merged
