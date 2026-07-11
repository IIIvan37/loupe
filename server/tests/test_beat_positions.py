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


class TestSpuriousBeats:
    def test_payload_drops_a_beat_inserted_right_after_a_real_one(self) -> None:
        # 75 BPM (0.8 s gaps) with a detector double-fire 80 ms after the third
        # beat — a subdivision misread, not a beat; it must not reach the client.
        payload = tempo_payload([0.0, 0.8, 1.6, 1.68, 2.4, 3.2], [0.0, 3.2])
        assert [b["time"] for b in payload["beats"]] == [0.0, 0.8, 1.6, 2.4, 3.2]

    def test_keeps_a_single_wide_gap(self) -> None:
        # A missed beat (one long gap) removes nothing: only implausibly SHORT
        # gaps mark an inserted beat.
        payload = tempo_payload([0.0, 0.5, 1.0, 2.0, 2.5], [0.0])
        assert [b["time"] for b in payload["beats"]] == [0.0, 0.5, 1.0, 2.0, 2.5]

    def test_threshold_scales_with_the_track_beat_interval(self) -> None:
        # At 30 BPM (2 s gaps) a 0.5 s follower is spurious even though the same
        # gap would be a legitimate beat at 120 BPM.
        payload = tempo_payload([0.0, 2.0, 2.5, 4.0, 6.0], [0.0])
        assert [b["time"] for b in payload["beats"]] == [0.0, 2.0, 4.0, 6.0]

    def test_keeps_the_downbeat_of_a_close_pair_not_the_fire_before_it(self) -> None:
        # The double-fire lands 80 ms BEFORE the real bar-line beat: keeping the
        # first of the pair would orphan the downbeat (0.8 matches nothing within
        # the 0.05 s tolerance) and corrupt every bar number after it.
        payload = tempo_payload([0.0, 0.72, 0.8, 1.6, 2.4, 3.2], [0.0, 0.8])
        assert [b["time"] for b in payload["beats"]] == [0.0, 0.8, 1.6, 2.4, 3.2]

    def test_downbeat_flag_survives_a_double_fire_on_the_bar_line(self) -> None:
        # Double-fire ON the downbeat instant: the reported downbeat (1.68) must
        # still reset the bar count, not vanish into the dropped beat.
        payload = tempo_payload([0.0, 0.8, 1.6, 1.68, 2.4, 3.2], [0.0, 1.68])
        assert [b["position"] for b in payload["beats"]] == [1, 2, 1, 2, 3]

    def test_keeps_a_sustained_genuine_fast_section(self) -> None:
        # 60 BPM then a real 160 BPM section (ratio 2.67x): a sustained section
        # is a tempo change, not a run of double-fires — no beat may be dropped.
        slow = [float(i) for i in range(16)]
        fast = [15.0 + i * 0.375 for i in range(1, 17)]
        payload = tempo_payload(slow + fast, [0.0])
        assert [b["time"] for b in payload["beats"]] == slow + fast

    def test_collapses_duplicate_beat_instants(self) -> None:
        # Zero gaps must count as spurious, not poison the median with zeros.
        payload = tempo_payload([0.0, 0.0, 0.5, 0.5, 1.0, 1.0], [0.0])
        assert [b["time"] for b in payload["beats"]] == [0.0, 0.5, 1.0]


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
