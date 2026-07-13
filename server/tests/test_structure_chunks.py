"""Unit tests for the pure structure-detection chunk plan (torch-free)."""

from __future__ import annotations

import pytest

from app.structure_chunks import chunk_plan


class TestChunkPlan:
    def test_a_short_track_is_one_chunk_covering_the_whole_thing(self) -> None:
        # Under one chunk length: a single window, no margins to add (the track
        # already fits), owning [0, duration].
        plan = chunk_plan(120.0, chunk_s=180.0, overlap_s=20.0)
        assert len(plan) == 1
        w = plan[0]
        assert (w["own_start"], w["own_end"]) == (0.0, 120.0)
        assert (w["proc_start"], w["proc_end"]) == (0.0, 120.0)

    def test_a_long_track_splits_into_owned_windows_that_tile_it(self) -> None:
        # 310s / 180s chunk -> 2 windows owning [0,180) and [180,310); the owned
        # regions are contiguous and cover the whole track with no gap/overlap.
        plan = chunk_plan(310.0, chunk_s=180.0, overlap_s=20.0)
        assert len(plan) == 2
        assert plan[0]["own_start"] == 0.0
        assert plan[0]["own_end"] == 180.0
        assert plan[1]["own_start"] == 180.0
        assert plan[1]["own_end"] == 310.0

    def test_interior_windows_carry_a_context_margin_on_both_sides(self) -> None:
        # The second window is processed with `overlap_s` of audio before and
        # after its owned region, so the model's start-of-input "intro" bias
        # lands in the discarded margin, not on a section boundary.
        plan = chunk_plan(310.0, chunk_s=180.0, overlap_s=20.0)
        assert plan[1]["proc_start"] == 160.0
        assert plan[1]["proc_end"] == 310.0  # clamped to duration, not 330

    def test_the_first_windows_left_margin_is_clamped_to_zero(self) -> None:
        plan = chunk_plan(310.0, chunk_s=180.0, overlap_s=20.0)
        assert plan[0]["proc_start"] == 0.0
        assert plan[0]["proc_end"] == 200.0

    def test_a_sub_second_tail_does_not_spawn_an_empty_window(self) -> None:
        # 180.5s / 180s: the 0.5s tail would own [180, 180.5) — too short to
        # analyse, so it is dropped rather than sent to the model.
        plan = chunk_plan(180.5, chunk_s=180.0, overlap_s=20.0)
        assert len(plan) == 1
        assert plan[0]["own_end"] == 180.0

    def test_zero_overlap_processes_exactly_the_owned_region(self) -> None:
        plan = chunk_plan(360.0, chunk_s=180.0, overlap_s=0.0)
        assert plan[0]["proc_start"] == plan[0]["own_start"]
        assert plan[0]["proc_end"] == plan[0]["own_end"]

    def test_no_duration_plans_no_windows(self) -> None:
        assert chunk_plan(0.0, chunk_s=180.0, overlap_s=20.0) == []

    def test_degenerate_inputs_are_rejected(self) -> None:
        with pytest.raises(ValueError):
            chunk_plan(120.0, chunk_s=0.0, overlap_s=20.0)
        with pytest.raises(ValueError):
            chunk_plan(120.0, chunk_s=180.0, overlap_s=-1.0)
