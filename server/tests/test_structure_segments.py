"""Unit tests for the pure structure-segment stitcher (torch-free)."""

from __future__ import annotations

from app.structure_chunks import ChunkWindow
from app.structure_segments import stitch_segments


def _win(own_start: float, own_end: float, proc_start: float, proc_end: float) -> ChunkWindow:
    return {
        "own_start": own_start,
        "own_end": own_end,
        "proc_start": proc_start,
        "proc_end": proc_end,
    }


class TestStitchSegments:
    def test_a_single_window_passes_its_segments_through(self) -> None:
        window = _win(0.0, 120.0, 0.0, 120.0)
        segs = [
            {"start": 0.0, "end": 40.0, "label": "intro"},
            {"start": 40.0, "end": 120.0, "label": "verse"},
        ]
        out = stitch_segments([(window, segs)], duration=120.0)
        assert out == [
            {"start": 0.0, "end": 40.0, "label": "intro"},
            {"start": 40.0, "end": 120.0, "label": "verse"},
        ]

    def test_segment_times_are_offset_by_the_windows_proc_start(self) -> None:
        # A window owning [180,310) is processed from 160s; the model reports
        # times relative to that slice, so a segment at local 26.76s is at
        # absolute 186.76s.
        window = _win(180.0, 310.0, 160.0, 310.0)
        segs = [{"start": 26.76, "end": 67.32, "label": "chorus"}]
        out = stitch_segments([(window, segs)], duration=310.0)
        assert out[0]["start"] == 186.76
        assert out[0]["label"] == "chorus"

    def test_a_segment_whose_centre_is_outside_the_owned_region_is_dropped(self) -> None:
        # The parasitic "intro" the model emits at the START of a chunk's input
        # sits in the left margin (before own_start): its centre is outside the
        # owned region, so it is discarded, not stitched in.
        window = _win(180.0, 310.0, 160.0, 310.0)
        segs = [
            {"start": 0.0, "end": 12.0, "label": "intro"},  # abs 160-172, mid 166 < 180
            {"start": 26.76, "end": 67.32, "label": "chorus"},  # abs 186.76-227
        ]
        out = stitch_segments([(window, segs)], duration=310.0)
        assert [s["label"] for s in out] == ["chorus"]

    def test_a_section_split_across_a_seam_merges_into_one(self) -> None:
        # Same label owned on both sides of the 180s seam -> one section, not two.
        w0 = _win(0.0, 180.0, 0.0, 200.0)
        w1 = _win(180.0, 310.0, 160.0, 310.0)
        s0 = [{"start": 150.0, "end": 180.0, "label": "verse"}]
        s1 = [{"start": 20.0, "end": 70.0, "label": "verse"}]  # abs 180-230
        out = stitch_segments([(w0, s0), (w1, s1)], duration=310.0)
        assert len(out) == 1
        assert out[0]["label"] == "verse"
        assert out[0]["start"] == 150.0
        assert out[0]["end"] == 230.0

    def test_a_seam_gap_left_by_trimming_is_closed(self) -> None:
        # Ownership clipping can leave a hole between the last owned segment of
        # one chunk and the first of the next; a marker draft wants back-to-back
        # sections, so the earlier extends to the later's start.
        w0 = _win(0.0, 180.0, 0.0, 200.0)
        w1 = _win(180.0, 310.0, 160.0, 310.0)
        s0 = [{"start": 140.0, "end": 180.0, "label": "verse"}]
        s1 = [{"start": 26.76, "end": 70.0, "label": "chorus"}]  # abs 186.76-230
        out = stitch_segments([(w0, s0), (w1, s1)], duration=310.0)
        assert [s["label"] for s in out] == ["verse", "chorus"]
        assert out[0]["end"] == out[1]["start"] == 186.76  # gap closed

    def test_the_final_segment_is_clamped_to_the_track_length(self) -> None:
        window = _win(0.0, 120.0, 0.0, 120.0)
        segs = [{"start": 0.0, "end": 130.0, "label": "verse"}]  # model over-runs
        out = stitch_segments([(window, segs)], duration=120.0)
        assert out[0]["end"] == 120.0

    def test_the_interior_is_contiguous_even_across_a_dropped_tail(self) -> None:
        # A sub-second tail chunk_plan dropped leaves the last owned window
        # ending before `duration`; stitch does NOT anchor the tail (the core
        # snap does), but the interior it returns stays back-to-back.
        window = _win(0.0, 180.0, 0.0, 180.7)
        segs = [
            {"start": 0.0, "end": 120.0, "label": "verse"},
            {"start": 120.0, "end": 180.0, "label": "outro"},
        ]
        out = stitch_segments([(window, segs)], duration=180.7)
        assert out[0]["end"] == out[1]["start"] == 120.0

    def test_no_chunks_stitch_to_nothing(self) -> None:
        assert stitch_segments([], duration=120.0) == []
