//! Project manifest store + manifest-scan GC — the Rust side of the
//! `/projects` and `/gc` contract in `server/app/projects.py` (same
//! directory, same format: manifests under `<data_dir>/projects/<id>.json`),
//! so switching route 1 → route 2 needs zero migration. Manifests are opaque
//! JSON: the core owns the `Project` shape, this server only files it.

use crate::audio_store::{is_valid_ref, AudioStore};
use crate::fs_atomic::write_atomic;
use serde_json::Value;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

/// Ids are caller-minted (UUIDs in practice) — this gates what may appear in
/// a filesystem path (mirror of `_ID_PATTERN`).
pub fn is_valid_project_id(candidate: &str) -> bool {
  !candidate.is_empty()
    && candidate.len() <= 128
    && candidate
      .bytes()
      .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

#[derive(Debug)]
pub enum ProjectError {
  /// A malformed id or an absent manifest — both answered 404, like Python's
  /// `_project_path` + `is_file` checks.
  UnknownProject,
  /// The manifest is opaque (persisted verbatim) but must at least be JSON.
  NotJson,
  /// A real filesystem fault (permissions, disk) — never disguised as an
  /// absent project.
  Io(String),
}

#[derive(Clone, Debug)]
pub struct ProjectStore {
  projects_dir: PathBuf,
}

impl ProjectStore {
  pub fn new(data_dir: &Path) -> Self {
    Self {
      projects_dir: data_dir.join("projects"),
    }
  }

  /// The manifest's path, or None for anything not shaped like one of our
  /// ids. Ids exclude `.` and `/`, so the path can never escape the dir.
  fn manifest_path(&self, project_id: &str) -> Option<PathBuf> {
    is_valid_project_id(project_id).then(|| self.projects_dir.join(format!("{project_id}.json")))
  }

  /// The manifest's raw bytes, exactly as saved.
  pub fn load(&self, project_id: &str) -> Result<Vec<u8>, ProjectError> {
    let path = self
      .manifest_path(project_id)
      .ok_or(ProjectError::UnknownProject)?;
    match std::fs::read(&path) {
      Ok(bytes) => Ok(bytes),
      Err(e) if e.kind() == std::io::ErrorKind::NotFound => Err(ProjectError::UnknownProject),
      Err(e) => Err(ProjectError::Io(e.to_string())),
    }
  }

  /// Persist the manifest verbatim, atomically — a half-written manifest is
  /// never exposed under its id.
  pub fn save(&self, project_id: &str, manifest: &[u8]) -> Result<(), ProjectError> {
    let path = self
      .manifest_path(project_id)
      .ok_or(ProjectError::UnknownProject)?;
    // IgnoredAny: full syntactic validation without building a JSON tree —
    // manifests run to MBs and this sits on the autosave path.
    if serde_json::from_slice::<serde::de::IgnoredAny>(manifest).is_err() {
      return Err(ProjectError::NotJson);
    }
    write_atomic(&self.projects_dir, &path, manifest).map_err(|e| ProjectError::Io(e.to_string()))
  }

  /// Idempotent: deleting an absent project succeeds.
  pub fn delete(&self, project_id: &str) -> Result<(), ProjectError> {
    let path = self
      .manifest_path(project_id)
      .ok_or(ProjectError::UnknownProject)?;
    match std::fs::remove_file(&path) {
      Ok(()) => Ok(()),
      Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
      Err(e) => Err(ProjectError::Io(e.to_string())),
    }
  }

  /// Every parseable manifest, sorted by filename — one corrupt manifest must
  /// not hide the others.
  pub fn list(&self) -> Vec<Value> {
    self.read_manifests().0
  }

  /// Every parseable manifest, plus the count that would not read or parse.
  /// No `is_file` pre-filter: a `*.json` entry that cannot be read (a stray
  /// directory, a permissions fault) must count as unreadable so the GC
  /// aborts, exactly like Python's glob + failed `read_text`.
  fn read_manifests(&self) -> (Vec<Value>, usize) {
    let Ok(entries) = std::fs::read_dir(&self.projects_dir) else {
      return (Vec::new(), 0);
    };
    let mut paths: Vec<PathBuf> = entries
      .flatten()
      .map(|entry| entry.path())
      .filter(|path| path.extension().is_some_and(|ext| ext == "json"))
      .collect();
    paths.sort();
    let mut manifests = Vec::new();
    let mut unreadable = 0;
    for path in paths {
      match std::fs::read(&path)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
      {
        Some(manifest) => manifests.push(manifest),
        None => unreadable += 1,
      }
    }
    (manifests, unreadable)
  }
}

/// Every audio ref the given manifests point at.
///
/// Manifests stay opaque: an audio ref is any sha256-shaped string anywhere
/// in the JSON (the source, each stem, and any future ref-bearing field), so
/// this never needs to know the `Project` shape. Nothing else in a manifest
/// is a 64-char hex string, so there are no false positives.
pub fn referenced_refs(manifests: &[Value]) -> HashSet<String> {
  fn walk(node: &Value, refs: &mut HashSet<String>) {
    match node {
      Value::String(text) if is_valid_ref(text) => {
        refs.insert(text.clone());
      }
      Value::Object(map) => map.values().for_each(|value| walk(value, refs)),
      Value::Array(items) => items.iter().for_each(|value| walk(value, refs)),
      _ => {}
    }
  }
  let mut refs = HashSet::new();
  for manifest in manifests {
    walk(manifest, &mut refs);
  }
  refs
}

/// Reclaim content-addressed blobs no manifest references.
///
/// A manifest-scan GC, exactly what the core's `ProjectAudioStore` doc defers
/// to the adapter: gather every ref the manifests use, delete every blob
/// whose name is not among them. **Conservative** — if any manifest can't be
/// read or parsed we abort without deleting a thing, since we cannot account
/// for its refs and would risk erasing live audio. Run when idle: a blob just
/// uploaded but not yet named by a saved manifest would look orphaned.
pub fn collect_garbage(projects: &ProjectStore, audio: &AudioStore) -> Value {
  let (manifests, unreadable) = projects.read_manifests();
  if unreadable > 0 {
    return serde_json::json!({
      "deleted": 0,
      "reclaimedBytes": 0,
      "skipped": true,
      "unreadableManifests": unreadable,
    });
  }

  let live = referenced_refs(&manifests);
  let (deleted, reclaimed) = audio.sweep_orphans(&live);
  serde_json::json!({"deleted": deleted, "reclaimedBytes": reclaimed, "kept": live.len()})
}

#[cfg(test)]
mod tests {
  use super::*;

  const REF_A: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const REF_B: &str = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const REF_C: &str = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

  fn audio_with_blobs(dir: &Path, blobs: &[(&str, &[u8])]) -> AudioStore {
    let audio_dir = dir.join("audio");
    std::fs::create_dir_all(&audio_dir).unwrap();
    for (name, bytes) in blobs {
      std::fs::write(audio_dir.join(name), bytes).unwrap();
    }
    AudioStore::new(dir, u64::MAX)
  }

  #[test]
  fn accepts_only_filesystem_safe_project_ids() {
    assert!(is_valid_project_id("p1"));
    assert!(is_valid_project_id("A-b_9"));
    assert!(is_valid_project_id(&"x".repeat(128)));
    assert!(!is_valid_project_id(""));
    assert!(!is_valid_project_id(&"x".repeat(129)));
    assert!(!is_valid_project_id("bad*id"));
    assert!(!is_valid_project_id("../escape"));
    assert!(!is_valid_project_id("dot.json"));
  }

  #[test]
  fn save_load_delete_roundtrip_is_idempotent_on_delete() {
    let dir = tempfile::tempdir().unwrap();
    let store = ProjectStore::new(dir.path());
    store.save("p1", br#"{"id":"p1"}"#).unwrap();
    assert_eq!(store.load("p1").unwrap(), br#"{"id":"p1"}"#);
    // Persisted verbatim, atomically: no leftover tmp next to the manifest.
    let leftovers: Vec<_> = std::fs::read_dir(dir.path().join("projects"))
      .unwrap()
      .flatten()
      .map(|entry| entry.path())
      .filter(|path| path.extension().is_some_and(|ext| ext == "tmp"))
      .collect();
    assert_eq!(leftovers, Vec::<PathBuf>::new());
    assert!(store.delete("p1").is_ok());
    assert!(matches!(
      store.load("p1"),
      Err(ProjectError::UnknownProject)
    ));
    assert!(store.delete("p1").is_ok());
    assert!(matches!(
      store.delete("bad*id"),
      Err(ProjectError::UnknownProject)
    ));
  }

  #[test]
  fn save_refuses_a_manifest_that_is_not_json() {
    let dir = tempfile::tempdir().unwrap();
    let store = ProjectStore::new(dir.path());
    assert!(matches!(
      store.save("p1", b"{ not json"),
      Err(ProjectError::NotJson)
    ));
    assert!(matches!(
      store.save("bad*id", b"{}"),
      Err(ProjectError::UnknownProject)
    ));
    assert!(matches!(
      store.load("p1"),
      Err(ProjectError::UnknownProject)
    ));
  }

  #[cfg(unix)]
  #[test]
  fn load_surfaces_a_read_fault_instead_of_pretending_absence() {
    use std::os::unix::fs::PermissionsExt;
    let dir = tempfile::tempdir().unwrap();
    let store = ProjectStore::new(dir.path());
    store.save("p1", b"{}").unwrap();
    let path = dir.path().join("projects/p1.json");
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o000)).unwrap();
    assert!(matches!(store.load("p1"), Err(ProjectError::Io(_))));
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644)).unwrap();
  }

  #[test]
  fn list_is_sorted_and_skips_a_corrupt_manifest() {
    let dir = tempfile::tempdir().unwrap();
    let store = ProjectStore::new(dir.path());
    assert_eq!(store.list(), Vec::<Value>::new());
    store.save("b", br#"{"id":"b"}"#).unwrap();
    store.save("a", br#"{"id":"a"}"#).unwrap();
    std::fs::write(dir.path().join("projects/broken.json"), "{ nope").unwrap();
    assert_eq!(
      store.list(),
      vec![
        serde_json::json!({"id": "a"}),
        serde_json::json!({"id": "b"})
      ]
    );
  }

  #[test]
  fn referenced_refs_walks_source_and_stems_and_ignores_non_ref_strings() {
    let manifest = serde_json::json!({
      "id": "p1",
      "name": "not a ref",
      "source": {"audioRef": REF_A},
      "separation": {"stems": [{"audioRef": REF_B}, {"audioRef": REF_C}]},
    });
    let refs = referenced_refs(&[manifest]);
    assert_eq!(
      refs,
      HashSet::from([REF_A.to_owned(), REF_B.to_owned(), REF_C.to_owned()])
    );
  }

  #[test]
  fn gc_deletes_orphans_and_keeps_referenced() {
    let dir = tempfile::tempdir().unwrap();
    let audio = audio_with_blobs(dir.path(), &[(REF_A, b"kept"), (REF_B, b"orphan bytes")]);
    let projects = ProjectStore::new(dir.path());
    projects
      .save(
        "p1",
        format!(r#"{{"source":{{"audioRef":"{REF_A}"}}}}"#).as_bytes(),
      )
      .unwrap();

    let result = collect_garbage(&projects, &audio);

    assert_eq!(
      result,
      serde_json::json!({"deleted": 1, "reclaimedBytes": 12, "kept": 1})
    );
    assert!(dir.path().join("audio").join(REF_A).exists());
    assert!(!dir.path().join("audio").join(REF_B).exists());
  }

  #[test]
  fn gc_aborts_without_deleting_when_a_manifest_is_unreadable() {
    let dir = tempfile::tempdir().unwrap();
    let audio = audio_with_blobs(dir.path(), &[(REF_A, b"x")]);
    let projects = ProjectStore::new(dir.path());
    std::fs::create_dir_all(dir.path().join("projects")).unwrap();
    std::fs::write(dir.path().join("projects/broken.json"), "{ not json").unwrap();

    let result = collect_garbage(&projects, &audio);

    assert_eq!(
      result,
      serde_json::json!({
        "deleted": 0,
        "reclaimedBytes": 0,
        "skipped": true,
        "unreadableManifests": 1,
      })
    );
    // Never delete on incomplete reference information.
    assert!(dir.path().join("audio").join(REF_A).exists());
  }

  #[test]
  fn gc_aborts_on_a_json_entry_that_cannot_be_read_at_all() {
    // A stray DIRECTORY named like a manifest: Python's glob picks it up and
    // the failed read aborts the sweep — the port must be as conservative.
    let dir = tempfile::tempdir().unwrap();
    let audio = audio_with_blobs(dir.path(), &[(REF_A, b"x")]);
    let projects = ProjectStore::new(dir.path());
    std::fs::create_dir_all(dir.path().join("projects/trap.json")).unwrap();

    let result = collect_garbage(&projects, &audio);

    assert_eq!(result["skipped"], serde_json::json!(true));
    assert!(dir.path().join("audio").join(REF_A).exists());
  }

  #[test]
  fn gc_leaves_non_blob_files_alone() {
    let dir = tempfile::tempdir().unwrap();
    // An interrupted upload next to nothing referenced.
    let audio = audio_with_blobs(dir.path(), &[]);
    let tmp = dir.path().join("audio").join(format!("{REF_A}.tmp"));
    std::fs::write(&tmp, b"half").unwrap();
    let projects = ProjectStore::new(dir.path());

    collect_garbage(&projects, &audio);

    assert!(tmp.exists());
  }

  #[cfg(unix)]
  #[test]
  fn gc_counts_only_blobs_it_actually_deleted() {
    use std::os::unix::fs::PermissionsExt;
    let dir = tempfile::tempdir().unwrap();
    let audio = audio_with_blobs(dir.path(), &[(REF_B, b"orphan bytes")]);
    let projects = ProjectStore::new(dir.path());
    // A read-only directory makes the unlink fail: the blob stays, so the
    // summary must not report its bytes as reclaimed.
    let audio_dir = dir.path().join("audio");
    std::fs::set_permissions(&audio_dir, std::fs::Permissions::from_mode(0o555)).unwrap();

    let result = collect_garbage(&projects, &audio);

    std::fs::set_permissions(&audio_dir, std::fs::Permissions::from_mode(0o755)).unwrap();
    assert_eq!(
      result,
      serde_json::json!({"deleted": 0, "reclaimedBytes": 0, "kept": 0})
    );
    assert!(audio_dir.join(REF_B).exists());
  }

  #[test]
  fn gc_on_empty_store_is_a_noop() {
    let dir = tempfile::tempdir().unwrap();
    let result = collect_garbage(
      &ProjectStore::new(dir.path()),
      &AudioStore::new(dir.path(), 1),
    );
    assert_eq!(
      result,
      serde_json::json!({"deleted": 0, "reclaimedBytes": 0, "kept": 0})
    );
  }
}
