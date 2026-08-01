//! Atomic file write shared by the stores: write to a uniquely named .tmp in
//! the destination's directory, then rename over the destination — a
//! half-written file is never exposed under its final name, and the unique
//! tmp name keeps concurrent writers of the same destination (autosave
//! bursts on `spawn_blocking` threads) from truncating each other's buffer.
//!
//! Everything the stores put on disk is private to the user (AW.2, aligned
//! with the Python stems store's 0700): dirs 0700, files 0600. The tmp file
//! carries the mode from birth and `rename` preserves it, so a blob or
//! manifest is never readable by other local users, not even for a moment.

use std::io::Write;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

static SEQUENCE: AtomicU64 = AtomicU64::new(0);

pub fn write_atomic(dir: &Path, path: &Path, bytes: &[u8]) -> std::io::Result<()> {
  create_private_dir_all(dir)?;
  // Unconditional on the leaf: a store dir a wheel-era install created with
  // the default umask converges to private on its first write.
  make_private_dir(dir)?;
  let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("file");
  let tmp = dir.join(format!(
    "{file_name}.{}.{}.tmp",
    std::process::id(),
    SEQUENCE.fetch_add(1, Ordering::Relaxed)
  ));
  write_private(&tmp, bytes)?;
  std::fs::rename(&tmp, path).inspect_err(|_| {
    // Never leave a stray tmp behind a failed rename.
    let _ = std::fs::remove_file(&tmp);
  })
}

/// `create_dir_all`, except every component WE create is born 0700. A dir
/// that already exists is left untouched — it may be a parent the user owns
/// (a custom `LOUPE_DATA_DIR` under an existing tree).
pub fn create_private_dir_all(dir: &Path) -> std::io::Result<()> {
  if dir.as_os_str().is_empty() || dir.is_dir() {
    return Ok(());
  }
  if let Some(parent) = dir.parent() {
    create_private_dir_all(parent)?;
  }
  match std::fs::create_dir(dir) {
    Ok(()) => make_private_dir(dir),
    // A concurrent creator won the race — the dir exists, which is all we
    // needed from this component.
    Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => Ok(()),
    Err(e) => Err(e),
  }
}

/// 0700 on unix; nothing to do on Windows, where the user profile's ACLs
/// already scope access.
pub fn make_private_dir(dir: &Path) -> std::io::Result<()> {
  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(dir, std::fs::Permissions::from_mode(0o700))?;
  }
  #[cfg(not(unix))]
  let _ = dir;
  Ok(())
}

/// `fs::write` with the file born 0600 (unix) — permissions set at open, so
/// there is no window where the default umask exposes the bytes.
fn write_private(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
  let mut options = std::fs::OpenOptions::new();
  options.write(true).create_new(true);
  #[cfg(unix)]
  {
    use std::os::unix::fs::OpenOptionsExt;
    options.mode(0o600);
  }
  options.open(path)?.write_all(bytes)
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

  #[cfg(unix)]
  fn mode(path: &Path) -> u32 {
    use std::os::unix::fs::PermissionsExt;
    std::fs::metadata(path).unwrap().permissions().mode() & 0o777
  }

  #[cfg(unix)]
  #[test]
  fn store_dirs_are_born_0700_and_files_0600() {
    let dir = tempfile::tempdir().unwrap();
    let store = dir.path().join("nested").join("projects");
    let target = store.join("out.json");
    write_atomic(&store, &target, b"{}").unwrap();
    // Every component we created, not just the leaf — a 0755 intermediate
    // would expose the whole store to other local users.
    assert_eq!(mode(&store), 0o700);
    assert_eq!(mode(&dir.path().join("nested")), 0o700);
    assert_eq!(mode(&target), 0o600);
  }

  #[cfg(unix)]
  #[test]
  fn a_wheel_era_store_dir_is_tightened_on_write() {
    use std::os::unix::fs::PermissionsExt;
    let dir = tempfile::tempdir().unwrap();
    let store = dir.path().join("projects");
    std::fs::create_dir_all(&store).unwrap();
    std::fs::set_permissions(&store, std::fs::Permissions::from_mode(0o755)).unwrap();
    write_atomic(&store, &store.join("out.json"), b"{}").unwrap();
    assert_eq!(mode(&store), 0o700);
  }
}
