//! Runtime configuration — the env contract shared with the Python server
//! (`server/app/origins.py`, `limits.py`, `projects.py`, `download.py`): same
//! variable names, same defaults, same parsing quirks (fallback only when the
//! var is UNSET, garbage falls back to the default). The parsers are pure
//! (they take the raw value) so tests never mutate process-global env.

use std::path::PathBuf;
use std::time::Duration;

/// Parity with `server/app/origins.py` — 5173 = Vite dev, 6173 = the
/// distributed local server.
pub const DEFAULT_ALLOWED_ORIGINS: &str = "http://localhost:5173,http://127.0.0.1:5173\
,http://localhost:6173,http://127.0.0.1:6173";

pub const DEFAULT_ALLOWED_HOSTS: &str = "localhost,127.0.0.1";

/// 5173 belongs to Vite dev; 6173 keeps the mnemonic and the two can coexist
/// (same choice as `server/app/cli.py`, D3).
pub const DEFAULT_PORT: u16 = 6173;

#[derive(Clone, Debug)]
pub struct Config {
  pub data_dir: PathBuf,
  pub allowed_hosts: Vec<String>,
  pub allowed_origins: Vec<String>,
  pub max_upload_bytes: u64,
  pub max_manifest_bytes: u64,
  pub max_audio_store_bytes: u64,
  /// Whole-request budget for one `/download` stream, queue wait included.
  pub download_timeout: Duration,
  pub download_slots: usize,
}

impl Config {
  pub fn from_env() -> Self {
    let var = |name: &str| std::env::var(name).ok();
    Self {
      data_dir: data_dir(var("LOUPE_DATA_DIR").as_deref()),
      allowed_hosts: env_list(var("LOUPE_ALLOWED_HOSTS").as_deref(), DEFAULT_ALLOWED_HOSTS),
      allowed_origins: allowed_origins(var("LOUPE_ALLOWED_ORIGINS").as_deref()),
      max_upload_bytes: mb_env(var("LOUPE_MAX_UPLOAD_MB").as_deref(), 500),
      max_manifest_bytes: mb_env(var("LOUPE_MAX_MANIFEST_MB").as_deref(), 16),
      max_audio_store_bytes: mb_env(var("LOUPE_MAX_AUDIO_STORE_MB").as_deref(), 10240),
      download_timeout: seconds_env(var("LOUPE_DOWNLOAD_TIMEOUT_SECONDS").as_deref(), 900),
      download_slots: concurrency_slots(var("LOUPE_MAX_CONCURRENT_DOWNLOADS").as_deref()),
    }
  }
}

/// Comma-separated value → trimmed, non-empty entries. The default applies
/// only when the var is UNSET — set-but-empty means "no entries".
pub fn env_list(raw: Option<&str>, default: &str) -> Vec<String> {
  raw
    .unwrap_or(default)
    .split(',')
    .map(str::trim)
    .filter(|item| !item.is_empty())
    .map(str::to_owned)
    .collect()
}

/// The origins allowed to call us from a browser. A literal `*` entry is
/// dropped (fails CLOSED) — same policy and rationale as `origins.py`: a
/// wildcard "to unblock an origin quickly" must never open the surface.
pub fn allowed_origins(raw: Option<&str>) -> Vec<String> {
  env_list(raw, DEFAULT_ALLOWED_ORIGINS)
    .into_iter()
    .filter(|origin| origin != "*")
    .collect()
}

/// A size cap in MB from an env value — digits only, otherwise the default.
pub fn mb_env(raw: Option<&str>, default_mb: u64) -> u64 {
  let mb = raw
    .filter(|r| !r.is_empty() && r.bytes().all(|b| b.is_ascii_digit()))
    .and_then(|r| r.parse().ok())
    .unwrap_or(default_mb);
  mb * 1024 * 1024
}

/// A timeout from an env value — absent/garbage/zero falls back (0 would make
/// every guarded wait expire instantly, never a valid timeout).
pub fn seconds_env(raw: Option<&str>, default_seconds: u64) -> Duration {
  let seconds = raw
    .filter(|r| !r.is_empty() && r.bytes().all(|b| b.is_ascii_digit()))
    .and_then(|r| r.parse().ok())
    .filter(|&s: &u64| s > 0)
    .unwrap_or(default_seconds);
  Duration::from_secs(seconds)
}

/// Download-slot count from an env value — never below 1 (0 would deadlock).
pub fn concurrency_slots(raw: Option<&str>) -> usize {
  raw
    .filter(|r| !r.is_empty() && r.bytes().all(|b| b.is_ascii_digit()))
    .and_then(|r| r.parse().ok())
    .unwrap_or(1)
    .max(1)
}

/// The storage root: `LOUPE_DATA_DIR` or `~/.loupe` (D2 decision — idiomatic
/// for a CLI tool, and route 1 already stores there so migration is zero
/// code). A set-but-empty var counts as unset (never store in the cwd).
pub fn data_dir(env_value: Option<&str>) -> PathBuf {
  match env_value.filter(|v| !v.is_empty()) {
    Some(value) => expand_user(value),
    None => home_dir().join(".loupe"),
  }
}

/// Minimal `Path.home()` equivalent, without a platform-dirs dependency.
fn home_dir() -> PathBuf {
  std::env::var_os("HOME")
    .or_else(|| std::env::var_os("USERPROFILE"))
    .map(PathBuf::from)
    .unwrap_or_else(|| PathBuf::from("."))
}

/// `expanduser` parity for the one form people actually pass (`~/...`).
fn expand_user(value: &str) -> PathBuf {
  match value.strip_prefix("~/") {
    Some(rest) => home_dir().join(rest),
    None => PathBuf::from(value),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn env_list_falls_back_only_when_unset() {
    assert_eq!(env_list(None, "a,b"), vec!["a", "b"]);
    assert_eq!(env_list(Some(" x , ,y "), "a,b"), vec!["x", "y"]);
    assert_eq!(env_list(Some(""), "a,b"), Vec::<String>::new());
  }

  #[test]
  fn allowed_origins_drop_the_wildcard_and_keep_the_dev_defaults() {
    assert!(allowed_origins(None).contains(&"http://localhost:6173".to_owned()));
    assert!(allowed_origins(None).contains(&"http://localhost:5173".to_owned()));
    assert_eq!(allowed_origins(Some("*")), Vec::<String>::new());
    assert_eq!(allowed_origins(Some("http://a,*")), vec!["http://a"]);
  }

  #[test]
  fn mb_env_accepts_digits_and_falls_back_on_garbage() {
    assert_eq!(mb_env(None, 500), 500 * 1024 * 1024);
    assert_eq!(mb_env(Some("2"), 500), 2 * 1024 * 1024);
    assert_eq!(mb_env(Some("2GB"), 500), 500 * 1024 * 1024);
    assert_eq!(mb_env(Some("-1"), 500), 500 * 1024 * 1024);
  }

  #[test]
  fn seconds_env_refuses_zero_and_garbage() {
    assert_eq!(seconds_env(None, 900), Duration::from_secs(900));
    assert_eq!(seconds_env(Some("60"), 900), Duration::from_secs(60));
    assert_eq!(seconds_env(Some("0"), 900), Duration::from_secs(900));
    assert_eq!(seconds_env(Some("soon"), 900), Duration::from_secs(900));
  }

  #[test]
  fn concurrency_slots_never_drop_below_one() {
    assert_eq!(concurrency_slots(None), 1);
    assert_eq!(concurrency_slots(Some("3")), 3);
    assert_eq!(concurrency_slots(Some("0")), 1);
    assert_eq!(concurrency_slots(Some("lots")), 1);
  }

  #[test]
  fn data_dir_expands_tilde_and_defaults_to_dot_loupe() {
    assert!(data_dir(None).ends_with(".loupe"));
    assert_eq!(data_dir(Some("/tmp/x")), PathBuf::from("/tmp/x"));
    assert!(data_dir(Some("~/x")).ends_with("x"));
    assert!(!data_dir(Some("~/x")).starts_with("~"));
    assert!(data_dir(Some("")).ends_with(".loupe"));
  }
}
