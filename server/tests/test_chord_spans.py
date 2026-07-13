"""Unit tests for the pure frame → chord-span fold (torch-free)."""

from __future__ import annotations

from app.chord_spans import LARGE_VOCABULARY, MAJMIN_VOCABULARY, chord_spans


class TestChordSpans:
    def test_groups_consecutive_equal_frames_into_one_span(self) -> None:
        # Four 1-second frames: C C A:min A:min.
        assert chord_spans([0, 0, 18 + 1, 19], 1.0, 4.0) == [
            {"start": 0.0, "end": 2.0, "label": "C"},
            {"start": 2.0, "end": 4.0, "label": "A:min"},
        ]

    def test_a_single_chord_is_one_span_over_the_whole_song(self) -> None:
        assert chord_spans([4, 4, 4], 1.0, 3.0) == [{"start": 0.0, "end": 3.0, "label": "D"}]

    def test_clamps_the_final_span_to_the_song_length(self) -> None:
        # The model pads the song to whole windows: 4 frames cover 4 s but the
        # song is only 3.2 s long.
        assert chord_spans([24, 24, 24, 24], 1.0, 3.2) == [{"start": 0.0, "end": 3.2, "label": "N"}]

    def test_a_change_on_the_final_frame_still_emits_its_span(self) -> None:
        spans = chord_spans([0, 0, 14], 1.0, 3.0)
        assert spans == [
            {"start": 0.0, "end": 2.0, "label": "C"},
            {"start": 2.0, "end": 3.0, "label": "G"},
        ]

    def test_an_out_of_vocabulary_index_reads_as_no_chord(self) -> None:
        assert chord_spans([999], 1.0, 1.0) == [{"start": 0.0, "end": 1.0, "label": "N"}]
        assert chord_spans([-1], 1.0, 1.0) == [{"start": 0.0, "end": 1.0, "label": "N"}]

    def test_no_frames_fold_to_no_spans(self) -> None:
        assert chord_spans([], 1.0, 3.0) == []

    def test_degenerate_rates_and_lengths_fold_to_no_spans(self) -> None:
        assert chord_spans([0, 0], 0.0, 3.0) == []
        assert chord_spans([0, 0], 1.0, 0.0) == []

    def test_padding_entirely_past_the_song_end_is_dropped(self) -> None:
        # A trailing chord change that starts beyond the clamped song length
        # (pure padding) must not emit an inverted span.
        spans = chord_spans([0, 0, 7], 1.0, 1.5)
        assert spans == [
            {"start": 0.0, "end": 1.5, "label": "C"},
        ]

    def test_vocabulary_shape_matches_the_checkpoint(self) -> None:
        # 12 roots x maj/min + N = the 25 classes of btc_model.pt (voca=False).
        assert len(MAJMIN_VOCABULARY) == 25
        assert MAJMIN_VOCABULARY[24] == "N"

    def test_large_vocabulary_matches_idx2voca_chord(self) -> None:
        # 12 roots x 14 qualities + X + N = the 170 classes of the large-voca
        # checkpoint, exactly the repo's idx2voca_chord() ordering.
        assert len(LARGE_VOCABULARY) == 170
        assert LARGE_VOCABULARY[0] == "C:min"
        assert LARGE_VOCABULARY[1] == "C"  # maj prints as the bare root
        assert LARGE_VOCABULARY[8] == "C:maj7"
        assert LARGE_VOCABULARY[9] == "C:7"
        assert LARGE_VOCABULARY[11] == "C:hdim7"
        assert LARGE_VOCABULARY[13] == "C:sus4"
        assert LARGE_VOCABULARY[14] == "C#:min"
        assert LARGE_VOCABULARY[167] == "B:sus4"
        assert LARGE_VOCABULARY[168] == "X"
        assert LARGE_VOCABULARY[169] == "N"

    def test_reads_indices_against_the_given_vocabulary(self) -> None:
        # Index 9 is C:7 in the large vocabulary; the default maj-min set would
        # read it as G# — the vocabulary argument selects the reading.
        assert chord_spans([9], 1.0, 1.0, LARGE_VOCABULARY) == [
            {"start": 0.0, "end": 1.0, "label": "C:7"}
        ]
