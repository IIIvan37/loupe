"""Unit tests for the pure beat → bar-position mapping (torch-free)."""

from __future__ import annotations

from app.beat_positions import (
    representative_bpm,
    tempo_payload,
    to_positioned_beats,
)


def _positions(beats: list[float], downbeats: list[float], **kw) -> list[int]:
    return [b["position"] for b in to_positioned_beats(beats, downbeats, **kw)]


class TestRepresentativeBpm:
    def test_median_interval_becomes_bpm(self) -> None:
        # 0.5 s between beats -> 120 BPM.
        assert representative_bpm([0.0, 0.5, 1.0, 1.5]) == 120.0

    def test_uses_median_so_one_outlier_gap_does_not_skew(self) -> None:
        # Gaps 0.5, 0.5, 2.0 (a dropped beat) -> median 0.5 -> 120, not the mean.
        assert representative_bpm([0.0, 0.5, 1.0, 3.0]) == 120.0

    def test_fewer_than_two_beats_is_zero(self) -> None:
        assert representative_bpm([]) == 0.0
        assert representative_bpm([1.0]) == 0.0

    def test_non_increasing_beats_do_not_divide_by_zero(self) -> None:
        assert representative_bpm([1.0, 1.0]) == 0.0


class TestBarPositions:
    def test_common_time_numbers_each_bar_one_to_four(self) -> None:
        beats = [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5]
        downbeats = [0.0, 2.0]
        assert _positions(beats, downbeats) == [1, 2, 3, 4, 1, 2, 3, 4]

    def test_three_four_meter_numbers_one_to_three(self) -> None:
        beats = [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0]
        downbeats = [0.0, 1.5, 3.0]
        assert _positions(beats, downbeats) == [1, 2, 3, 1, 2, 3, 1]

    def test_downbeat_matched_within_tolerance(self) -> None:
        # The downbeat time is 20 ms off the beat time — still the same beat.
        beats = [0.0, 0.5, 1.0, 1.5]
        downbeats = [0.02, 1.02]
        assert _positions(beats, downbeats, tolerance=0.05) == [1, 2, 1, 2]

    def test_leading_pickup_beats_back_count_from_first_downbeat(self) -> None:
        # Two pickup beats, then two full 4/4 bars: the pickup reads as beats 3, 4.
        beats = [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0]
        downbeats = [1.0, 3.0]
        assert _positions(beats, downbeats) == [3, 4, 1, 2, 3, 4, 1]

    def test_single_downbeat_with_pickup_falls_back_to_ascending_lead(self) -> None:
        # Only one downbeat -> measure length unknown, so the two pickup beats
        # before it can't be back-counted; they number ascending (best effort).
        beats = [0.0, 0.5, 1.0, 1.5]
        downbeats = [1.0]
        assert _positions(beats, downbeats) == [1, 2, 1, 2]

    def test_no_downbeats_numbers_ascending_best_effort(self) -> None:
        beats = [0.0, 0.5, 1.0]
        assert _positions(beats, []) == [1, 2, 3]

    def test_empty_beats_maps_to_empty(self) -> None:
        assert to_positioned_beats([], []) == []


class TestTempoPayload:
    def test_bundles_bpm_and_positioned_beats(self) -> None:
        payload = tempo_payload([0.0, 0.5, 1.0, 1.5], [0.0, 1.0])
        assert payload["bpm"] == 120.0
        assert payload["beats"] == [
            {"time": 0.0, "position": 1},
            {"time": 0.5, "position": 2},
            {"time": 1.0, "position": 1},
            {"time": 1.5, "position": 2},
        ]
