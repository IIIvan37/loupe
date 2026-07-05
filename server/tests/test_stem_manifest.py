"""Stem ordering + naming (torch-free, extracted from separation.py).

Run: `.venv/bin/python -m pytest`.
"""

from __future__ import annotations

from app.stem_manifest import build_manifest

BASE = "http://localhost:8000/"


def test_orders_sources_into_the_ui_layout():
    # A 6-stem model handed back in Demucs' native order.
    native = ["drums", "bass", "other", "vocals", "guitar", "piano"]
    ids = [e.id for e in build_manifest(native, "job1", BASE)]
    assert ids == ["voix", "batterie", "basse", "guitare", "claviers", "autres"]


def test_maps_id_label_and_url():
    entry = build_manifest(["vocals"], "abc", BASE)[0]
    assert entry == (
        "vocals",
        "voix",
        "Voix",
        "http://localhost:8000/stems/abc/voix.wav",
    )


def test_four_stem_model_orders_its_subset():
    native = ["drums", "bass", "other", "vocals"]
    ids = [e.id for e in build_manifest(native, "j", BASE)]
    assert ids == ["voix", "batterie", "basse", "autres"]


def test_unknown_source_gets_a_title_cased_fallback_and_sorts_last():
    entries = build_manifest(["synth", "vocals"], "j", BASE)
    assert [e.id for e in entries] == ["voix", "synth"]
    synth = entries[-1]
    assert synth.label == "Synth"
    assert synth.url == "http://localhost:8000/stems/j/synth.wav"
