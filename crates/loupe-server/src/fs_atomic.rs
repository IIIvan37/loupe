//! Atomic file write shared by the stores: write to a uniquely named .tmp in
//! the destination's directory, then rename over the destination — a
//! half-written file is never exposed under its final name, and the unique
//! tmp name keeps concurrent writers of the same destination (autosave
//! bursts on `spawn_blocking` threads) from truncating each other's buffer.

use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

static SEQUENCE: AtomicU64 = AtomicU64::new(0);

pub fn write_atomic(dir: &Path, path: &Path, bytes: &[u8]) -> std::io::Result<()> {
  std::fs::create_dir_all(dir)?;
  let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("file");
  let tmp = dir.join(format!(
    "{file_name}.{}.{}.tmp",
    std::process::id(),
    SEQUENCE.fetch_add(1, Ordering::Relaxed)
  ));
  std::fs::write(&tmp, bytes)?;
  std::fs::rename(&tmp, path).inspect_err(|_| {
    // Never leave a stray tmp behind a failed rename.
    let _ = std::fs::remove_file(&tmp);
  })
}

#[cfg(test)]
mod tests {
  use super::*;

  fn tmp_leftovers(dir: &Path) -> Vec<std::path::PathBuf> {
    std::fs::read_dir(dir)
      .unwrap()
      .flatten()
      .map(|entry| entry.path())
      .filter(|path| path.extension().is_some_and(|ext| ext == "tmp"))
      .collect()
  }

  #[test]
  fn writes_the_destination_and_leaves_no_tmp() {
    let dir = tempfile::tempdir().unwrap();
    let target = dir.path().join("store/out.json");
    write_atomic(&dir.path().join("store"), &target, b"{}").unwrap();
    assert_eq!(std::fs::read(&target).unwrap(), b"{}");
    assert_eq!(
      tmp_leftovers(&dir.path().join("store")),
      Vec::<std::path::PathBuf>::new()
    );
  }

  #[test]
  fn replaces_an_existing_destination() {
    let dir = tempfile::tempdir().unwrap();
    let target = dir.path().join("out.json");
    write_atomic(dir.path(), &target, b"one").unwrap();
    write_atomic(dir.path(), &target, b"two").unwrap();
    assert_eq!(std::fs::read(&target).unwrap(), b"two");
  }
}
