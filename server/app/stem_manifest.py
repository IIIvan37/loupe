"""Stem naming, ordering, and served URLs — the decidable part of a separation.

Pure (torch-free) so it's unit-tested and type-checked, unlike its host
`separation.py` (which loads Demucs). It owns the map from Demucs' native source
names to the app's musician-friendly ids/labels, the stable UI display order, and
the `/stems` URL each gets — knowledge the web side reserves colours against. The
torch shell just runs the model and writes the WAVs this plans.
"""

from __future__ import annotations

from typing import NamedTuple

# Map Demucs' source names to the musician-friendly ids/labels the UI expects.
# The web reserves a colour per id (voix/batterie/basse/guitare/claviers/autres).
STEM_META: dict[str, tuple[str, str]] = {
    "vocals": ("voix", "Voix"),
    "drums": ("batterie", "Batterie"),
    "bass": ("basse", "Basse"),
    "guitar": ("guitare", "Guitare"),
    "piano": ("claviers", "Claviers"),
    "other": ("autres", "Autres"),
}

# Musician-friendly display order. Demucs' native order differs per model
# (4s: [drums, bass, other, vocals]; 6s adds guitar, piano), so we re-order to a
# stable UI layout. Sources absent from that order simply sort last.
DISPLAY_ORDER = ["vocals", "drums", "bass", "guitar", "piano", "other"]


class StemEntry(NamedTuple):
    """One planned stem: `source` indexes the model output; the rest is the manifest."""

    source: str  # Demucs' native source name (index into the model's outputs)
    id: str  # musician-friendly id — the WAV filename + mixer channel id
    label: str  # display label
    url: str  # where the client fetches the WAV


def _display_index(name: str) -> int:
    return DISPLAY_ORDER.index(name) if name in DISPLAY_ORDER else len(DISPLAY_ORDER)


def build_manifest(sources: list[str], job: str, base_url: str) -> list[StemEntry]:
    """Order `sources` into the UI layout and map each to its id/label/url.

    `base_url` ends with '/'. An unknown source keeps its name as id and a
    title-cased label, and sorts after the known ones.
    """
    entries: list[StemEntry] = []
    for name in sorted(sources, key=_display_index):
        stem_id, label = STEM_META.get(name, (name, name.title()))
        entries.append(StemEntry(name, stem_id, label, f"{base_url}stems/{job}/{stem_id}.wav"))
    return entries
