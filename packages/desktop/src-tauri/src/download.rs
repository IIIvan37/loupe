//! Import-from-URL for the desktop shell (T2.3): drive a managed yt-dlp
//! binary as a subprocess, at guard parity with `server/app/download.py`
//! (host allowlist, total wall-clock budget, size cap, socket timeout, one
//! download at a time). The binary is NOT bundled: yt-dlp goes stale in
//! weeks, so it is fetched into app-data on first use (yt-dlp itself is
//! Unlicense — invoking it imposes nothing on this app's licence, unlike
//! the GPL-3.0 wrapper crate that was evaluated and rejected) and kept
//! fresh with its built-in `-U` self-updater, at most once a day.

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;
use tauri::ipc::Channel;
use tauri::Manager;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::{Mutex, Notify};

/// Mirror of `server/app/download.py` guards. Keep the host list in sync with
/// that file and the core allowlist (`packages/core/src/application/supported-source.ts`).
const SUPPORTED_HOSTS: [&str; 3] = ["youtube.com", "youtu.be", "soundcloud.com"];
const DOWNLOAD_TIMEOUT_SECONDS: u64 = 900;
const MAX_FILESIZE: &str = "500m";
const SOCKET_TIMEOUT_SECONDS: &str = "30";
/// A one-time binary fetch that hangs past this returns an error rather than
/// stalling the download forever (the server has yt-dlp installed already).
const BINARY_FETCH_TIMEOUT: Duration = Duration::from_secs(300);
/// Re-run `yt-dlp -U` at most once per this window.
const SELF_UPDATE_WINDOW: Duration = Duration::from_secs(24 * 60 * 60);

const YT_DLP_RELEASE_BASE: &str =
  "https://github.com/yt-dlp/yt-dlp/releases/latest/download/";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum ProgressEvent {
  #[serde(rename = "progress")]
  Progress { phase: &'static str, fraction: f64 },
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadedTrack {
  /// Path of the audio file, relative to the app-data dir (the webview reads
  /// it back through the fs plugin, which is scoped to app-data).
  pub relative_path: String,
  pub title: String,
  pub duration_seconds: Option<f64>,
  pub uploader: Option<String>,
}

/// One download at a time (the server holds a BoundedSemaphore(1) the same
/// way). Holds the cancel signal for the in-flight download so
/// `cancel_download` can ask it to kill its own `Child` — no raw pid, so no
/// chance of signalling a process that reused the pid after we finished.
#[derive(Default)]
pub struct DownloadState {
  cancel: Mutex<Option<Arc<Notify>>>,
}

/// The exact host rule of `_is_supported` / `isSupportedSourceUrl`: http(s)
/// only, exact host or dot-boundary subdomain of an allowed host. This is a
/// trust boundary — the webview caller is already gated by the core policy,
/// but the command must not rely on that.
fn is_supported_url(url: &str) -> bool {
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

fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  app
    .path()
    .app_data_dir()
    .map_err(|e| format!("app data dir unavailable: {e}"))
}

/// Fetch the yt-dlp binary into `bin/` on first use; afterwards trigger its
/// built-in self-updater at most once per day, **fire-and-forget** so it
/// never delays a download (a stale extractor speaks at run time). Only the
/// first-ever fetch blocks — and it is bounded by `BINARY_FETCH_TIMEOUT`.
async fn ensure_binary(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let bin_dir = app_data_dir(app)?.join("bin");
  let binary = bin_dir.join(binary_name());
  if binary.exists() {
    spawn_self_update_if_stale(&binary, &bin_dir);
    return Ok(binary);
  }
  std::fs::create_dir_all(&bin_dir)
    .map_err(|e| format!("cannot create {}: {e}", bin_dir.display()))?;
  let url = format!("{YT_DLP_RELEASE_BASE}{}", release_asset());
  let bytes = tokio::time::timeout(
    BINARY_FETCH_TIMEOUT,
    tokio::task::spawn_blocking(move || fetch_bytes(&url)),
  )
  .await
  .map_err(|_| "yt-dlp download timed out".to_string())?
  .map_err(|e| e.to_string())??;
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

/// Run the download inside the wall-clock budget, streaming progress to the
/// webview. Returns the produced audio file (relative to app-data) plus the
/// metadata yt-dlp wrote next to it.
#[tauri::command]
pub async fn download_track(
  app: tauri::AppHandle,
  state: tauri::State<'_, DownloadState>,
  url: String,
  on_progress: Channel<ProgressEvent>,
) -> Result<DownloadedTrack, String> {
  if !is_supported_url(&url) {
    return Err(format!("unsupported source URL: {url}"));
  }
  let cancel = Arc::new(Notify::new());
  {
    let mut slot = state.cancel.lock().await;
    if slot.is_some() {
      return Err("a download is already running".into());
    }
    *slot = Some(cancel.clone());
  }
  let outcome = run_download(&app, &url, &on_progress, cancel).await;
  *state.cancel.lock().await = None;
  outcome
}

async fn run_download(
  app: &tauri::AppHandle,
  url: &str,
  on_progress: &Channel<ProgressEvent>,
  cancel: Arc<Notify>,
) -> Result<DownloadedTrack, String> {
  // Emit before the (possibly slow, first-run) binary bootstrap so the UI
  // shows a live bar immediately instead of an indistinguishable-from-hung
  // zero state.
  let _ = on_progress.send(ProgressEvent::Progress {
    phase: "downloading",
    fraction: 0.0,
  });
  let binary = ensure_binary(app).await?;
  let data_dir = app_data_dir(app)?;
  // Backstop cleanup: a temp dir lives for exactly one download (removed on
  // success by the webview, on failure below), and only one runs at a time,
  // so anything lingering here is an orphan from a crash, power loss or a
  // kill whose per-op removal lost a flush/unlink race. Sweep it before we
  // start rather than trust every exit path to clean up after itself.
  sweep_orphan_downloads(&data_dir.join("downloads"));
  let out_rel = format!("downloads/{}", download_dir_name());
  let out_dir = data_dir.join(&out_rel);
  std::fs::create_dir_all(&out_dir).map_err(|e| e.to_string())?;

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
    .map_err(|e| format!("cannot start yt-dlp: {e}"))?;

  let stdout = child.stdout.take();
  let progress = on_progress.clone();
  let reader = tokio::spawn(async move {
    let Some(stdout) = stdout else { return };
    let mut lines = BufReader::new(stdout).lines();
    while let Ok(Some(line)) = lines.next_line().await {
      if let Some(fraction) = parse_progress_line(&line) {
        let _ = progress.send(ProgressEvent::Progress {
          phase: "downloading",
          fraction,
        });
      }
    }
  });

  let outcome = tokio::select! {
    // Total budget, not per-event — a trickle does not re-arm it.
    status = tokio::time::timeout(Duration::from_secs(DOWNLOAD_TIMEOUT_SECONDS), child.wait()) => {
      match status {
        Err(_) => {
          let _ = child.kill().await;
          Err("download timed out".into())
        }
        Ok(Err(e)) => Err(format!("download failed: {e}")),
        Ok(Ok(status)) if !status.success() => {
          // The dominant real-world cause is a stale extractor — same hint as
          // the server, minus the pip incantation (the binary self-updates).
          Err("download failed — the extractor may be out of date; retry later".into())
        }
        Ok(Ok(_)) => {
          // A completed bar while the file is finalised, like the server's
          // synthetic transcoding event.
          let _ = on_progress.send(ProgressEvent::Progress { phase: "transcoding", fraction: 1.0 });
          collect_result(&out_dir, &out_rel)
        }
      }
    }
    // Cancel kills this download's own child — never a pid that might have
    // been reused. The webview treats the rejection as a stale run.
    _ = cancel.notified() => {
      let _ = child.start_kill();
      let _ = child.wait().await;
      Err("download cancelled".into())
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

/// Ask the in-flight download (if any) to kill its own child. The webview
/// treats the resulting command rejection as a stale run (run-token pattern),
/// never an error.
#[tauri::command]
pub async fn cancel_download(state: tauri::State<'_, DownloadState>) -> Result<(), String> {
  if let Some(cancel) = state.cancel.lock().await.as_ref() {
    cancel.notify_one();
  }
  Ok(())
}

/// Remove every leftover per-download temp dir (best-effort).
fn sweep_orphan_downloads(downloads_dir: &Path) {
  let Ok(entries) = std::fs::read_dir(downloads_dir) else {
    return;
  };
  for entry in entries.flatten() {
    let _ = std::fs::remove_dir_all(entry.path());
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
}
