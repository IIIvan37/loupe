"""Tests for the manifest-scan blob GC (`app.projects.collect_garbage`).

The GC deletes files, so it earns a test. Run from the server root:

    .venv/bin/python -m pytest

`referenced_refs` is pure; `collect_garbage` reads the two store dirs, which the
fixture points at a tmp path so nothing touches the real `~/.loupe`.
"""

from __future__ import annotations

import json

import pytest

from app import projects

REF_A = "a" * 64
REF_B = "b" * 64
REF_C = "c" * 64


@pytest.fixture
def store(tmp_path, monkeypatch):
    """Point the module's store dirs at a fresh tmp path; return (audio, projects)."""
    audio = tmp_path / "audio"
    projects_dir = tmp_path / "projects"
    audio.mkdir()
    projects_dir.mkdir()
    monkeypatch.setattr(projects, "AUDIO_DIR", audio)
    monkeypatch.setattr(projects, "PROJECTS_DIR", projects_dir)
    return audio, projects_dir


def _manifest(projects_dir, name, data):
    (projects_dir / f"{name}.json").write_text(json.dumps(data), "utf-8")


def test_referenced_refs_walks_source_and_stems():
    manifest = {
        "id": "p1",
        "name": "Song",
        "source": {"audioRef": REF_A},
        "separation": {"stems": [{"audioRef": REF_B}, {"audioRef": REF_C}]},
    }
    assert projects.referenced_refs([manifest]) == {REF_A, REF_B, REF_C}


def test_referenced_refs_ignores_non_ref_strings():
    manifest = {"name": "not a ref", "source": {"audioRef": REF_A}}
    assert projects.referenced_refs([manifest]) == {REF_A}


def test_gc_deletes_orphans_and_keeps_referenced(store):
    audio, projects_dir = store
    (audio / REF_A).write_bytes(b"kept")
    (audio / REF_B).write_bytes(b"orphan bytes")
    _manifest(projects_dir, "p1", {"source": {"audioRef": REF_A}})

    result = projects.collect_garbage()

    assert result == {"deleted": 1, "reclaimedBytes": len(b"orphan bytes"), "kept": 1}
    assert (audio / REF_A).exists()
    assert not (audio / REF_B).exists()


def test_gc_aborts_without_deleting_when_a_manifest_is_unreadable(store):
    audio, projects_dir = store
    (audio / REF_A).write_bytes(b"x")
    (projects_dir / "broken.json").write_text("{ not json", "utf-8")

    result = projects.collect_garbage()

    assert result["skipped"] is True
    assert result["deleted"] == 0
    assert (audio / REF_A).exists()  # never delete on incomplete reference info


def test_gc_leaves_non_blob_files_alone(store):
    audio, _ = store
    tmp = audio / f"{REF_A}.tmp"  # an interrupted upload
    tmp.write_bytes(b"half")

    projects.collect_garbage()

    assert tmp.exists()


def test_gc_on_empty_store_is_a_noop(store):
    result = projects.collect_garbage()
    assert result == {"deleted": 0, "reclaimedBytes": 0, "kept": 0}
