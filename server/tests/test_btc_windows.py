"""Unit tests for the pure TIMESTEP window plan (torch-free)."""

from __future__ import annotations

import pytest

from app.btc_windows import window_plan


class TestWindowPlan:
    def test_an_exact_multiple_needs_no_padding(self) -> None:
        plan = window_plan(216, 108)
        assert plan["pad"] == 0
        assert plan["slices"] == [(0, 108), (108, 216)]

    def test_a_partial_tail_pads_up_to_one_whole_window(self) -> None:
        # 217 frames: the lone tail frame still gets a full (padded) window —
        # dropping it would silently truncate the last chords of the song.
        plan = window_plan(217, 108)
        assert plan["pad"] == 107
        assert plan["slices"] == [(0, 108), (108, 216), (216, 324)]

    def test_fewer_frames_than_one_window_still_yield_one_window(self) -> None:
        plan = window_plan(1, 108)
        assert plan["pad"] == 107
        assert plan["slices"] == [(0, 108)]

    def test_slices_tile_the_padded_length_without_gap_or_overlap(self) -> None:
        # An off-by-one here would shift every chord by a window.
        plan = window_plan(500, 108)
        padded = 500 + plan["pad"]
        assert padded % 108 == 0
        assert plan["slices"][0][0] == 0
        assert plan["slices"][-1][1] == padded
        for (_, end), (start, _) in zip(plan["slices"], plan["slices"][1:], strict=False):
            assert start == end

    def test_no_frames_plan_no_windows(self) -> None:
        assert window_plan(0, 108) == {"pad": 0, "slices": []}

    def test_degenerate_inputs_are_rejected(self) -> None:
        with pytest.raises(ValueError):
            window_plan(10, 0)
        with pytest.raises(ValueError):
            window_plan(-1, 108)
