//! Shared yt-dlp download engine (distribution D4.a) behind the `loupe`
//! server binary (D4.b) — the only URL-download implementation since the
//! Python local server and the Tauri shell were retired.
//!
//! Drives a managed yt-dlp binary as a subprocess, guarded end to end (host
//! allowlist, total wall-clock budget, size
//! cap, socket timeout — callers enforce one-at-a-time). The binary is NOT
//! bundled: yt-dlp goes stale in weeks, so it is fetched into the caller's
//! data dir on first use (yt-dlp itself is Unlicense — invoking it imposes
//! nothing on this crate's licence, unlike the GPL-3.0 wrapper crate that was
//! evaluated and rejected) and kept fresh with its built-in `-U`
//! self-updater, at most once a day.
//!
//! Host-shell concerns stay OUT of this crate: no Tauri, no HTTP framework —
//! progress is a plain callback, cancellation a `tokio::sync::Notify`, the
//! data dir a parameter. Callers need a running tokio runtime (the reader
//! task and the fire-and-forget self-update are spawned).

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Notify;

/// Mirror of the core allowlist
/// (`packages/core/src/application/supported-source.ts`) — the product source
/// of truth. Keep the two lists in sync.
const SUPPORTED_HOSTS: [&str; 3] = ["youtube.com", "youtu.be", "soundcloud.com"];
const DOWNLOAD_TIMEOUT_SECONDS: u64 = 900;
const MAX_FILESIZE: &str = "500m";
const SOCKET_TIMEOUT_SECONDS: &str = "30";
/// A one-time binary fetch that hangs past this returns an error rather than
/// stalling the download forever.
const BINARY_FETCH_TIMEOUT: Duration = Duration::from_secs(300);
/// Re-run `yt-dlp -U` at most once per this window.
const SELF_UPDATE_WINDOW: Duration = Duration::from_secs(24 * 60 * 60);

/// Pinned release: `latest/` is a moving target executed as native code, so
/// the bootstrap fetch verifies a version + sha256 pinned here (AC.1, same
/// policy as the server's sha256-pinned model weights). Freshness stays with
/// the daily `-U` self-update, which verifies its own hashes. Bumping =
/// updating these constants from the release's SHA2-256SUMS file.
const YT_DLP_VERSION: &str = "2026.07.04";

/// sha256 of this platform's asset in the pinned release (SHA2-256SUMS).
fn release_asset_sha256() -> &'static str {
  if cfg!(target_os = "windows") {
    "52fe3c26dcf71fbdc85b528589020bb0b8e383155cfa81b64dd447bbe35e24b8"
  } else if cfg!(target_os = "macos") {
    "498bd0dae17855c599d371d68ec5bafc439a9d8640e838be25c765a9792f261b"
  } else {
    "6bbb3d314cde4febe36e5fa1d55462e29c974f63444e707871834f6d8cc210ae"
  }
}

/// Progress callback: `(phase, completed fraction)`. Phases mirror the
/// server's NDJSON contract (`downloading`, then a final `transcoding`).
pub type ProgressFn = dyn Fn(&'static str, f64) + Send + Sync;

/// What went wrong, machine-readable: the web client maps each code to its
/// own translated copy (AV.1), so the code — not the English message — is the
/// UI contract. `Unknown` covers everything the user cannot act on.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DownloadErrorCode {
  Unsupported,
  Timeout,
  ExtractorStale,
  Unknown,
}

impl DownloadErrorCode {
  /// The kebab-case wire form the server's NDJSON error line carries.
  pub fn as_str(self) -> &'static str {
    match self {
      DownloadErrorCode::Unsupported => "unsupported",
      DownloadErrorCode::Timeout => "timeout",
      DownloadErrorCode::ExtractorStale => "extractor-stale",
      DownloadErrorCode::Unknown => "unknown",
    }
  }
}

/// A failed download: the `code` drives the client-side copy, the `message`
/// stays raw English for logs/console — it never reaches the UI.
#[derive(Debug)]
pub struct DownloadError {
  pub code: DownloadErrorCode,
  pub message: String,
}

impl DownloadError {
  pub fn new(code: DownloadErrorCode, message: impl Into<String>) -> Self {
    DownloadError {
      code,
      message: message.into(),
    }
  }

  pub fn unknown(message: impl Into<String>) -> Self {
    DownloadError::new(DownloadErrorCode::Unknown, message)
  }
}

impl std::fmt::Display for DownloadError {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    write!(f, "{}", self.message)
  }
}

impl std::error::Error for DownloadError {}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadedTrack {
  /// Path of the audio file, relative to the caller's data dir.
  pub relative_path: String,
  pub title: String,
  pub duration_seconds: Option<f64>,
  pub uploader: Option<String>,
}

/// The exact host rule of `_is_supported` / `isSupportedSourceUrl`: http(s)
/// only, exact host or dot-boundary subdomain of an allowed host. This is a
/// trust boundary — callers may be gated upstream, but this crate must not
/// rely on that.
pub fn is_supported_url(url: &str) -> bool {
  let Ok(parsed) = url::Url::parse(url) else {
    return false;
  };
  if parsed.scheme() != "http" && parsed.scheme() != "https" {
    return false;
  }
  let Some(host) = parsed.host_str() else {
    return false;
  };
  SUPPORTED_HOSTS
    .iter()
    .any(|h| host == *h || host.ends_with(&format!(".{h}")))
}

/// Parse one `--progress-template` line into a completed fraction.
/// The template prints `PROGRESS <downloaded> <total>`; totals may be `NA`
/// when yt-dlp has no estimate yet.
fn parse_progress_line(line: &str) -> Option<f64> {
  let rest = line.trim().strip_prefix("PROGRESS ")?;
  let mut parts = rest.split_whitespace();
  let downloaded: f64 = parts.next()?.parse().ok()?;
  let total: f64 = parts.next()?.parse().ok()?;
  if total <= 0.0 {
    return None;
  }
  Some((downloaded / total).clamp(0.0, 1.0))
}

/// The release asset for this platform.
fn release_asset() -> &'static str {
  if cfg!(target_os = "windows") {
    "yt-dlp.exe"
  } else if cfg!(target_os = "macos") {
    "yt-dlp_macos"
  } else {
    "yt-dlp_linux"
  }
}

fn binary_name() -> &'static str {
  if cfg!(target_os = "windows") {
    "yt-dlp.exe"
  } else {
    "yt-dlp"
  }
}

/// Fetch the yt-dlp binary into `<data_dir>/bin` on first use; afterwards
/// trigger its built-in self-updater at most once per day, **fire-and-forget**
/// so it never delays a download (a stale extractor speaks at run time). Only
/// the first-ever fetch blocks — and it is bounded by `BINARY_FETCH_TIMEOUT`.
async fn ensure_binary(data_dir: &Path) -> Result<PathBuf, String> {
  let bin_dir = data_dir.join("bin");
  let binary = bin_dir.join(binary_name());
  if binary.exists() {
    spawn_self_update_if_stale(&binary, &bin_dir);
    return Ok(binary);
  }
  std::fs::create_dir_all(&bin_dir)
    .map_err(|e| format!("cannot create {}: {e}", bin_dir.display()))?;
  let url = format!(
    "https://github.com/yt-dlp/yt-dlp/releases/download/{YT_DLP_VERSION}/{}",
    release_asset()
  );
  let bytes = tokio::time::timeout(
    BINARY_FETCH_TIMEOUT,
    tokio::task::spawn_blocking(move || fetch_bytes(&url)),
  )
  .await
  .map_err(|_| "yt-dlp download timed out".to_string())?
  .map_err(|e| e.to_string())??;
  verify_sha256(&bytes, release_asset_sha256())?;
  let tmp = binary.with_extension("tmp");
  std::fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o755))
      .map_err(|e| e.to_string())?;
  }
  std::fs::rename(&tmp, &binary).map_err(|e| e.to_string())?;
  Ok(binary)
}

/// Refuse to install (and later execute) bytes whose digest is not the one
/// pinned for this release — TLS alone trusts whatever the release serves.
fn verify_sha256(bytes: &[u8], expected: &str) -> Result<(), String> {
  use sha2::{Digest, Sha256};
  let digest = hex::encode(Sha256::digest(bytes));
  if digest != expected {
    return Err(format!(
      "yt-dlp integrity check failed: sha256 {digest} != pinned {expected}"
    ));
  }
  Ok(())
}

fn fetch_bytes(url: &str) -> Result<Vec<u8>, String> {
  use std::io::Read;
  let response = ureq::get(url)
    .call()
    .map_err(|e| format!("yt-dlp fetch failed: {e}"))?;
  let mut bytes = Vec::new();
  response
    .into_body()
    .into_reader()
    .read_to_end(&mut bytes)
    .map_err(|e| format!("yt-dlp fetch failed: {e}"))?;
  Ok(bytes)
}

fn spawn_self_update_if_stale(binary: &Path, bin_dir: &Path) {
  let marker = bin_dir.join(".last-update-check");
  let fresh = marker
    .metadata()
    .and_then(|m| m.modified())
    .ok()
    .and_then(|t| t.elapsed().ok())
    .is_some_and(|age| age < SELF_UPDATE_WINDOW);
  if fresh {
    return;
  }
  // Stamp the attempt now so a running update is not re-triggered; a failed
  // one retries at the next window, which is fine (best-effort freshness).
  let _ = std::fs::write(&marker, b"");
  let binary = binary.to_path_buf();
  tokio::spawn(async move {
    let _ = Command::new(&binary)
      .arg("-U")
      .stdout(Stdio::null())
      .stderr(Stdio::null())
      .status()
      .await;
  });
}

/// Run one download inside the wall-clock budget, streaming progress through
/// the callback. Returns the produced audio file (relative to `data_dir`)
/// plus the metadata yt-dlp wrote next to it. Callers enforce one-at-a-time
/// and own the `cancel` handle (notifying it kills this download's own
/// `Child` — never a pid that might have been reused).
pub async fn download_track(
  data_dir: &Path,
  url: &str,
  on_progress: Arc<ProgressFn>,
  cancel: Arc<Notify>,
) -> Result<DownloadedTrack, DownloadError> {
  if !is_supported_url(url) {
    return Err(DownloadError::new(
      DownloadErrorCode::Unsupported,
      format!("unsupported source URL: {url}"),
    ));
  }
  // Emit before the (possibly slow, first-run) binary bootstrap so the UI
  // shows a live bar immediately instead of an indistinguishable-from-hung
  // zero state.
  on_progress("downloading", 0.0);
  let binary = ensure_binary(data_dir)
    .await
    .map_err(DownloadError::unknown)?;
  // Backstop cleanup: a temp dir lives for exactly one download (removed on
  // success by the caller, on failure below), and only one runs at a time,
  // so anything lingering here is an orphan from a crash, power loss or a
  // kill whose per-op removal lost a flush/unlink race. Sweep it before we
  // start rather than trust every exit path to clean up after itself.
  sweep_stale_downloads(&data_dir.join("downloads"));
  let out_rel = format!("downloads/{}", download_dir_name());
  let out_dir = data_dir.join(&out_rel);
  std::fs::create_dir_all(&out_dir).map_err(|e| DownloadError::unknown(e.to_string()))?;

  let mut child = Command::new(&binary)
    .args([
      "--no-playlist",
      "--quiet",
      "--no-warnings",
      "--newline",
      "--max-filesize",
      MAX_FILESIZE,
      "--socket-timeout",
      SOCKET_TIMEOUT_SECONDS,
      "-f",
      "bestaudio[ext=m4a]/bestaudio",
      "--write-info-json",
      "--progress",
      "--progress-template",
      "PROGRESS %(progress.downloaded_bytes)s %(progress.total_bytes,progress.total_bytes_estimate)s",
      "-o",
    ])
    .arg(out_dir.join("%(id)s.%(ext)s"))
    .arg(url)
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .kill_on_drop(true)
    .spawn()
    .map_err(|e| DownloadError::unknown(format!("cannot start yt-dlp: {e}")))?;

  let stdout = child.stdout.take();
  let progress = on_progress.clone();
  let reader = tokio::spawn(async move {
    let Some(stdout) = stdout else { return };
    let mut lines = BufReader::new(stdout).lines();
    while let Ok(Some(line)) = lines.next_line().await {
      if let Some(fraction) = parse_progress_line(&line) {
        progress("downloading", fraction);
      }
    }
  });

  let outcome = tokio::select! {
    // Total budget, not per-event — a trickle does not re-arm it.
    status = tokio::time::timeout(Duration::from_secs(DOWNLOAD_TIMEOUT_SECONDS), child.wait()) => {
      match status {
        Err(_) => {
          let _ = child.kill().await;
          Err(DownloadError::new(DownloadErrorCode::Timeout, "download timed out"))
        }
        Ok(Err(e)) => Err(DownloadError::unknown(format!("download failed: {e}"))),
        Ok(Ok(status)) if !status.success() => {
          // The dominant real-world cause is a stale extractor — same hint as
          // the server, minus the pip incantation (the binary self-updates).
          Err(DownloadError::new(
            DownloadErrorCode::ExtractorStale,
            "download failed — the extractor may be out of date; retry later",
          ))
        }
        Ok(Ok(_)) => {
          // A completed bar while the file is finalised, like the server's
          // synthetic transcoding event.
          on_progress("transcoding", 1.0);
          collect_result(&out_dir, &out_rel).map_err(DownloadError::unknown)
        }
      }
    }
    _ = cancel.notified() => {
      let _ = child.start_kill();
      let _ = child.wait().await;
      // Never shown: the cancelling client has already dropped the stream.
      Err(DownloadError::unknown("download cancelled"))
    }
  };
  reader.abort();
  if outcome.is_err() {
    let _ = std::fs::remove_dir_all(&out_dir);
  }
  outcome
}

fn collect_result(out_dir: &Path, out_rel: &str) -> Result<DownloadedTrack, String> {
  let entries = std::fs::read_dir(out_dir).map_err(|e| e.to_string())?;
  let mut audio: Option<PathBuf> = None;
  let mut info: Option<PathBuf> = None;
  for entry in entries.flatten() {
    let path = entry.path();
    if path.extension().is_some_and(|e| e == "json") {
      info = Some(path);
    } else if path.is_file() {
      audio = Some(path);
    }
  }
  let Some(audio) = audio else {
    return Err("download produced no file — the track may exceed the size cap".into());
  };
  let (title, duration_seconds, uploader) = info
    .and_then(|p| std::fs::read_to_string(p).ok())
    .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
    .map(|v| {
      (
        v["title"].as_str().map(str::to_owned),
        v["duration"].as_f64(),
        v["uploader"].as_str().map(str::to_owned),
      )
    })
    .map(|(t, d, u)| (t.unwrap_or_else(|| "Sans titre".into()), d, u))
    .unwrap_or_else(|| ("Sans titre".into(), None, None));
  let file_name = audio
    .file_name()
    .and_then(|n| n.to_str())
    .ok_or("unreadable download file name")?;
  Ok(DownloadedTrack {
    relative_path: format!("{out_rel}/{file_name}"),
    title,
    duration_seconds,
    uploader,
  })
}

/// Only *stale* temp dirs are swept: several loupe processes (two `loupe`
/// servers on different ports) may share one data
/// dir, so an unconditional sweep would delete a concurrent instance's live
/// download. The margin is far beyond any real extraction time.
const STALE_AFTER: Duration = Duration::from_secs(60 * 60);

/// Remove leftover per-download temp dirs older than the stale threshold
/// (best-effort). Public so server shells can also sweep once at boot.
pub fn sweep_stale_downloads(downloads_dir: &Path) {
  sweep_downloads_older_than(downloads_dir, STALE_AFTER);
}

fn sweep_downloads_older_than(downloads_dir: &Path, stale_after: Duration) {
  let Ok(entries) = std::fs::read_dir(downloads_dir) else {
    return;
  };
  for entry in entries.flatten() {
    let stale = entry
      .metadata()
      .and_then(|m| m.modified())
      .ok()
      .and_then(|t| t.elapsed().ok())
      .is_some_and(|age| age >= stale_after);
    if stale {
      let _ = std::fs::remove_dir_all(entry.path());
    }
  }
}

/// A unique per-download temp-dir name (enough without pulling in a uuid crate
/// for a directory nobody indexes).
fn download_dir_name() -> String {
  let nanos = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_nanos())
    .unwrap_or(0);
  format!("dl-{nanos}-{}", std::process::id())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn accepts_supported_hosts_and_dot_boundary_subdomains() {
    assert!(is_supported_url("https://youtube.com/watch?v=x"));
    assert!(is_supported_url("https://music.youtube.com/watch?v=x"));
    assert!(is_supported_url("http://youtu.be/x"));
    assert!(is_supported_url("https://soundcloud.com/a/b"));
  }

  #[test]
  fn rejects_hostile_or_unsupported_urls() {
    assert!(!is_supported_url("https://youtube.com.evil.example/x"));
    assert!(!is_supported_url("https://vimeo.com/1"));
    assert!(!is_supported_url("ftp://youtube.com/x"));
    assert!(!is_supported_url("file:///etc/passwd"));
    assert!(!is_supported_url("not a url"));
  }

  #[test]
  fn accepts_bytes_matching_the_pinned_sha256() {
    // sha256("abc") — the NIST test vector.
    let expected = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    assert!(verify_sha256(b"abc", expected).is_ok());
  }

  #[test]
  fn refuses_bytes_whose_sha256_differs_from_the_pin() {
    let err = verify_sha256(b"tampered", release_asset_sha256()).unwrap_err();
    assert!(err.contains("integrity check failed"));
  }

  #[test]
  fn parses_progress_lines_and_ignores_noise() {
    assert_eq!(parse_progress_line("PROGRESS 50 200"), Some(0.25));
    assert_eq!(parse_progress_line("  PROGRESS 200 200 "), Some(1.0));
    assert_eq!(parse_progress_line("PROGRESS 300 200"), Some(1.0));
    assert_eq!(parse_progress_line("PROGRESS 1234.0 4936.0"), Some(0.25));
    assert_eq!(parse_progress_line("PROGRESS 10 NA"), None);
    assert_eq!(parse_progress_line("PROGRESS 10 0"), None);
    assert_eq!(parse_progress_line("[download] 12% of ~3MiB"), None);
    assert_eq!(parse_progress_line(""), None);
  }

  #[test]
  fn sweep_spares_fresh_dirs_and_removes_stale_ones() {
    let root = tempfile::tempdir().unwrap();
    let live = root.path().join("dl-live");
    std::fs::create_dir_all(live.join("nested")).unwrap();
    // A just-created dir is fresh: spared by the real threshold, removed by a
    // zero threshold (everything qualifies as stale).
    sweep_downloads_older_than(root.path(), STALE_AFTER);
    assert!(live.is_dir());
    sweep_downloads_older_than(root.path(), Duration::ZERO);
    assert!(!live.exists());
  }

  #[test]
  fn sweep_tolerates_a_missing_downloads_dir() {
    sweep_downloads_older_than(Path::new("/nonexistent/downloads"), Duration::ZERO);
  }

  #[tokio::test]
  async fn rejects_an_unsupported_url_before_any_filesystem_touch() {
    // The crate-level guard must hold without a data dir existing at all.
    let progress: Arc<ProgressFn> = Arc::new(|_, _| {});
    let err = download_track(
      Path::new("/nonexistent"),
      "https://vimeo.com/1",
      progress,
      Arc::new(Notify::new()),
    )
    .await
    .unwrap_err();
    assert_eq!(err.code, DownloadErrorCode::Unsupported);
    assert!(err.message.contains("unsupported source URL"));
  }

  #[test]
  fn error_codes_serialise_to_the_ndjson_wire_form() {
    assert_eq!(DownloadErrorCode::Unsupported.as_str(), "unsupported");
    assert_eq!(DownloadErrorCode::Timeout.as_str(), "timeout");
    assert_eq!(
      DownloadErrorCode::ExtractorStale.as_str(),
      "extractor-stale"
    );
    assert_eq!(DownloadErrorCode::Unknown.as_str(), "unknown");
  }
}
