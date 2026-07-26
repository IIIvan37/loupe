//! Content-addressed audio blob store — the Rust side of the `/audio`
//! contract in `server/app/projects.py` (same directory, same format: blobs
//! under `<data_dir>/audio/<sha256>`), so switching route 1 → route 2 needs
//! zero migration. Manifest routes (`/projects`, `/gc`) follow in D4.c.

use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

pub const QUOTA_MESSAGE: &str =
  "audio store quota exceeded — delete projects or raise LOUPE_MAX_AUDIO_STORE_MB";

#[derive(Debug)]
pub enum StoreError {
  /// A NEW blob would push the store past its byte cap. The GC only reclaims
  /// orphans, so this cap is the only bound on total disk use; a re-save of
  /// held bytes never grows the store and is always acknowledged.
  QuotaExceeded,
  Io(String),
}

/// Refs are our own sha256 hex digests — this gates what may appear in a
/// filesystem path (mirror of `_REF_PATTERN`).
pub fn is_valid_ref(candidate: &str) -> bool {
  candidate.len() == 64
    && candidate
      .bytes()
      .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

#[derive(Clone, Debug)]
pub struct AudioStore {
  audio_dir: PathBuf,
  max_store_bytes: u64,
}

impl AudioStore {
  pub fn new(data_dir: &Path, max_store_bytes: u64) -> Self {
    Self {
      audio_dir: data_dir.join("audio"),
      max_store_bytes,
    }
  }

  /// The blob's path, or None for anything not shaped like one of our refs.
  pub fn blob_path(&self, reference: &str) -> Option<PathBuf> {
    is_valid_ref(reference).then(|| self.audio_dir.join(reference))
  }

  /// Total bytes held by our content-addressed blobs (ignores strays/.tmp).
  fn store_size(&self) -> u64 {
    let Ok(entries) = std::fs::read_dir(&self.audio_dir) else {
      return 0;
    };
    entries
      .flatten()
      .filter(|entry| entry.file_name().to_str().is_some_and(is_valid_ref))
      .filter_map(|entry| entry.metadata().ok())
      .filter(|metadata| metadata.is_file())
      .map(|metadata| metadata.len())
      .sum()
  }

  /// The store's own content-addressed blobs — leaves .tmp files and
  /// anything else not named with a bare sha256 untouched.
  pub fn owned_blobs(&self) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(&self.audio_dir) else {
      return Vec::new();
    };
    entries
      .flatten()
      .filter(|entry| entry.file_name().to_str().is_some_and(is_valid_ref))
      .filter(|entry| entry.metadata().is_ok_and(|metadata| metadata.is_file()))
      .map(|entry| entry.path())
      .collect()
  }

  /// Park bytes in the content-addressed store, returning their sha256 ref.
  /// Idempotent: identical bytes re-point at the one blob. Written to a .tmp
  /// then renamed, so a half-written blob is never exposed under its ref.
  pub fn store(&self, data: &[u8]) -> Result<String, StoreError> {
    let reference = hex::encode(Sha256::digest(data));
    let path = self.audio_dir.join(&reference);
    if !path.exists() {
      if self.store_size() + data.len() as u64 > self.max_store_bytes {
        return Err(StoreError::QuotaExceeded);
      }
      let io = |e: std::io::Error| StoreError::Io(e.to_string());
      std::fs::create_dir_all(&self.audio_dir).map_err(io)?;
      let tmp = path.with_extension("tmp");
      std::fs::write(&tmp, data).map_err(io)?;
      std::fs::rename(&tmp, &path).map_err(io)?;
    }
    Ok(reference)
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn accepts_only_bare_sha256_hex_refs() {
    assert!(is_valid_ref(&"a".repeat(64)));
    assert!(is_valid_ref(&"0123456789abcdef".repeat(4)));
    assert!(!is_valid_ref(&"A".repeat(64)));
    assert!(!is_valid_ref(&"g".repeat(64)));
    assert!(!is_valid_ref(&"a".repeat(63)));
    assert!(!is_valid_ref("../../../etc/passwd"));
  }

  #[test]
  fn stores_bytes_under_their_sha256_and_is_idempotent() {
    let dir = tempfile::tempdir().unwrap();
    let store = AudioStore::new(dir.path(), 1024);
    let reference = store.store(b"abc").unwrap();
    // sha256("abc") — the NIST test vector.
    assert_eq!(
      reference,
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    let blob = store.blob_path(&reference).unwrap();
    assert_eq!(std::fs::read(&blob).unwrap(), b"abc");
    assert_eq!(store.store(b"abc").unwrap(), reference);
    assert!(!blob.with_extension("tmp").exists());
  }

  #[test]
  fn refuses_a_new_blob_past_the_quota_but_acknowledges_a_resave() {
    let dir = tempfile::tempdir().unwrap();
    let store = AudioStore::new(dir.path(), 4);
    let reference = store.store(b"1234").unwrap();
    assert!(matches!(
      store.store(b"5678"),
      Err(StoreError::QuotaExceeded)
    ));
    // Held bytes never grow the store: always acknowledged, even at the cap.
    assert_eq!(store.store(b"1234").unwrap(), reference);
  }

  #[test]
  fn quota_ignores_stray_files_that_are_not_our_blobs() {
    let dir = tempfile::tempdir().unwrap();
    let store = AudioStore::new(dir.path(), 8);
    std::fs::create_dir_all(dir.path().join("audio")).unwrap();
    std::fs::write(dir.path().join("audio/stray.tmp"), vec![0u8; 100]).unwrap();
    assert!(store.store(b"12345678").is_ok());
  }

  #[test]
  fn refuses_a_traversal_shaped_ref() {
    let dir = tempfile::tempdir().unwrap();
    let store = AudioStore::new(dir.path(), 1024);
    assert!(store.blob_path("../escape").is_none());
  }
}
