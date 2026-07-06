"""Beat -> bar-position mapping: the decidable part of tempo detection.

Pure (torch/numpy-free) so it's unit-tested and type-checked, unlike its host
`tempo.py` (which runs the beat_this model). beat_this returns two separate
arrays — beat instants and downbeat instants — but the enriched `/tempo` contract
the web `http-tempo-detector` adapter speaks wants one bar position per beat
(`{ time, position }`, `position == 1` = downbeat). This module owns that map:
mark each beat that coincides with a downbeat, number the beats within each bar,
and derive a representative BPM. The torch shell just runs the model and hands
the two arrays here.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Sequence
from statistics import median
from typing import TypedDict

# Default match window (seconds) between a downbeat instant and its beat. The
# model emits downbeats and beats from the same post-processor, so they line up
# tightly; this only absorbs float noise, staying well under a beat period.
DEFAULT_TOLERANCE = 0.05


class PositionedBeat(TypedDict):
    time: float
    position: int


def representative_bpm(beats: Sequence[float]) -> float:
    """Median-interval BPM — a single representative tempo for the read-out.

    Uses the median gap between consecutive beats so a few outlier intervals (a
    missed beat, a fill) don't skew it. Returns 0.0 when there aren't two beats,
    or when no gap is positive.
    """
    gaps = [b - a for a, b in zip(beats, beats[1:], strict=False) if b > a]
    if not gaps:
        return 0.0
    return 60.0 / median(gaps)


def _downbeat_flags(
    beats: Sequence[float], downbeats: Sequence[float], tolerance: float
) -> list[bool]:
    """Flag each beat that coincides with a downbeat (nearest match within tol)."""
    flags = [False] * len(beats)
    for downbeat in downbeats:
        nearest, smallest = None, tolerance
        for index, beat in enumerate(beats):
            gap = abs(beat - downbeat)
            if gap <= smallest:
                smallest, nearest = gap, index
        if nearest is not None:
            flags[nearest] = True
    return flags


def _measure_length(flags: Sequence[bool]) -> int:
    """Most common beat count between consecutive downbeats (0 if undetermined)."""
    downbeat_indices = [index for index, flag in enumerate(flags) if flag]
    gaps = [b - a for a, b in zip(downbeat_indices, downbeat_indices[1:], strict=False)]
    if not gaps:
        return 0
    return Counter(gaps).most_common(1)[0][0]


def _positions(flags: Sequence[bool]) -> list[int]:
    """Number every beat within its bar: 1 at each downbeat, counting up between."""
    first = next((index for index, flag in enumerate(flags) if flag), None)
    if first is None:
        # No downbeats detected: number every beat ascending from 1 (best effort).
        return [index + 1 for index in range(len(flags))]

    positions = [1] * len(flags)
    measure = _measure_length(flags)
    # Leading pickup beats before the first downbeat: back-count from it so the
    # bar phase reads right (..., measure-1, measure, [downbeat = 1]). Clamp at 1
    # if the pickup runs longer than a bar, or fall back to ascending when the
    # measure length is unknown (a single downbeat).
    for index in range(first):
        back = first - index  # 1 = the beat just before the first downbeat
        positions[index] = max(1, measure - back + 1) if measure else index + 1
    # From the first downbeat on: reset to 1 at each downbeat, else count up.
    counter = 0
    for index in range(first, len(flags)):
        counter = 1 if flags[index] else counter + 1
        positions[index] = counter
    return positions


def to_positioned_beats(
    beats: Sequence[float],
    downbeats: Sequence[float],
    tolerance: float = DEFAULT_TOLERANCE,
) -> list[PositionedBeat]:
    """Map beat + downbeat instants to `[{time, position}]` for the /tempo body."""
    times = [float(beat) for beat in beats]
    flags = _downbeat_flags(times, [float(d) for d in downbeats], tolerance)
    positions = _positions(flags)
    return [
        {"time": time, "position": position}
        for time, position in zip(times, positions, strict=True)
    ]


def tempo_payload(
    beats: Sequence[float],
    downbeats: Sequence[float],
    tolerance: float = DEFAULT_TOLERANCE,
) -> dict:
    """The full /tempo JSON body: representative bpm + positioned beats."""
    times = [float(beat) for beat in beats]
    return {
        "bpm": representative_bpm(times),
        "beats": to_positioned_beats(times, downbeats, tolerance),
    }
