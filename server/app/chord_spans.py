"""Frame predictions -> chord spans: the decidable part of chord recognition.

Pure (torch/numpy-free) so it's unit-tested and type-checked, unlike its host
`chords.py` (which runs the vendored BTC model). BTC classifies fixed-rate
frames — one chord-class index per frame — but the `/chords` contract the web
chord-detector adapter speaks wants labelled time spans
(`{ start, end, label }`, mir syntax, `N` = no chord). This module owns that
fold: group consecutive equal frames into one span, clamp the tail to the real
song length (the model pads the last window), and map indices to labels. The
torch shell just runs the model and hands the frame indices here.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import TypedDict

# The 25-class maj-min vocabulary of the default `btc_model.pt` checkpoint
# (voca=False): index 2k is a major root, 2k+1 its minor, 24 = "N" (no chord).
# mir syntax on the wire — translating to the web grid's own chord tokens is
# the adapter's job, mirroring how /tempo ships raw beat instants.
MAJMIN_VOCABULARY: tuple[str, ...] = (
    "C",
    "C:min",
    "C#",
    "C#:min",
    "D",
    "D:min",
    "D#",
    "D#:min",
    "E",
    "E:min",
    "F",
    "F:min",
    "F#",
    "F#:min",
    "G",
    "G:min",
    "G#",
    "G#:min",
    "A",
    "A:min",
    "A#",
    "A#:min",
    "B",
    "B:min",
    "N",
)

# The 170-class large vocabulary of `btc_model_large_voca.pt` — the BTC repo's
# `idx2voca_chord()` verbatim: 12 roots × 14 qualities (indices 0–167), then
# `X` (168, an out-of-vocabulary chord) and `N` (169, no chord). The `maj`
# quality (inner index 1) prints as the bare root (`C`, not `C:maj`); every
# other quality is `root:quality`. Sharps only, mir syntax on the wire — the
# web adapter re-spells to the key and maps qualities to grid tokens.
_LARGE_ROOTS = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")
_LARGE_QUALITIES = (
    "min",
    "maj",
    "dim",
    "aug",
    "min6",
    "maj6",
    "min7",
    "minmaj7",
    "maj7",
    "7",
    "dim7",
    "hdim7",
    "sus2",
    "sus4",
)


def _large_vocabulary() -> tuple[str, ...]:
    labels: list[str] = []
    for i in range(len(_LARGE_ROOTS) * len(_LARGE_QUALITIES)):
        root = _LARGE_ROOTS[i // len(_LARGE_QUALITIES)]
        quality = _LARGE_QUALITIES[i % len(_LARGE_QUALITIES)]
        labels.append(root if quality == "maj" else f"{root}:{quality}")
    return (*labels, "X", "N")


LARGE_VOCABULARY: tuple[str, ...] = _large_vocabulary()


class ChordSpan(TypedDict):
    start: float
    end: float
    label: str


def chord_spans(
    frames: Sequence[int],
    seconds_per_frame: float,
    song_length: float,
    vocabulary: tuple[str, ...] = MAJMIN_VOCABULARY,
) -> list[ChordSpan]:
    """Fold per-frame chord-class indices into labelled spans.

    Consecutive equal indices merge into one span; each span covers
    `[first_frame * seconds_per_frame, last_frame_end)` and the final span is
    clamped to `song_length` (the model rounds the song up to whole windows of
    padded frames). Indices are read against `vocabulary` (the maj-min set by
    default, the 170-class set for the large-voca checkpoint); an index outside
    it reads as "N" — a garbage frame must not crash the whole analysis.
    Zero-length results (no frames, or a non-positive song length) fold to no
    spans at all.
    """
    if seconds_per_frame <= 0 or song_length <= 0:
        return []
    spans: list[ChordSpan] = []
    start = 0.0
    previous: int | None = None
    for index, frame in enumerate(frames):
        if previous is None:
            previous = frame
            continue
        if frame != previous:
            boundary = index * seconds_per_frame
            spans.append(_span(start, boundary, previous, vocabulary))
            start = boundary
            previous = frame
    if previous is not None:
        spans.append(_span(start, len(frames) * seconds_per_frame, previous, vocabulary))
    # Clamp to the real song length: the model rounds the song up to whole
    # windows, so trailing frames — and any change inside them — are padding.
    clamped: list[ChordSpan] = []
    for span in spans:
        if span["start"] >= song_length:
            break
        clamped.append({**span, "end": min(span["end"], song_length)})
    return clamped


def _span(start: float, end: float, index: int, vocabulary: tuple[str, ...]) -> ChordSpan:
    label = vocabulary[index] if 0 <= index < len(vocabulary) else "N"
    return {"start": start, "end": end, "label": label}
