"""Feature frames -> BTC window plan: the decidable part of the inference loop.

Pure (torch/numpy-free) so it's unit-tested and type-checked, unlike its host
`chords.py` (which runs the vendored BTC model). The checkpoint consumes fixed
TIMESTEP-frame windows, so the song's feature matrix must be padded up to a
whole number of windows and sliced window by window — an off-by-one here would
shift every chord by a window without any test seeing it. This module owns
that arithmetic; the torch shell just pads and slices with the numbers it
returns.
"""

from __future__ import annotations

from typing import TypedDict


class WindowPlan(TypedDict):
    pad: int
    slices: list[tuple[int, int]]


def window_plan(frame_count: int, timestep: int) -> WindowPlan:
    """Pad `frame_count` frames up to whole `timestep` windows and slice them.

    `pad` is the number of frames to append (0 <= pad < timestep) and `slices`
    the `[start, end)` frame ranges tiling the padded length — contiguous,
    non-overlapping, one per window. A partial tail always gets a full padded
    window (dropping it would truncate the last chords); no frames plan no
    windows at all.
    """
    if timestep <= 0:
        raise ValueError("timestep must be positive")
    if frame_count < 0:
        raise ValueError("frame_count must be non-negative")
    pad = -frame_count % timestep if frame_count else 0
    windows = (frame_count + pad) // timestep
    return {
        "pad": pad,
        "slices": [(timestep * w, timestep * (w + 1)) for w in range(windows)],
    }
