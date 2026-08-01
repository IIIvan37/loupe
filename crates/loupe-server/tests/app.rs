//! Route-level tests — the axum app driven through `tower::ServiceExt`, at
//! parity with the Python suites (`test_netguard`, `test_projects`,
//! `test_download`): guards vetting every route, the `/audio` contract, and
//! the `/download` NDJSON stream over a fake engine.

use axum::body::Body;
use axum::extract::ConnectInfo;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use loupe_download::{DownloadError, DownloadErrorCode, DownloadedTrack, ProgressFn};
use loupe_server::config::Config;
use loupe_server::download::{DownloadEngine, TrackFuture};
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Notify;
use tower::ServiceExt;

fn test_config(data_dir: &Path) -> Config {
  Config {
    data_dir: data_dir.to_path_buf(),
    allowed_hosts: vec!["localhost".into(), "127.0.0.1".into()],
    allowed_origins: vec!["http://localhost:5173".into()],
    max_upload_bytes: 1024,
    max_manifest_bytes: 1024,
    max_audio_store_bytes: 1024,
    download_timeout: Duration::from_secs(5),
    download_slots: 1,
  }
}

/// A no-op engine for tests that never reach the download route.
struct InertEngine;

impl DownloadEngine for InertEngine {
  fn download(&self, _: PathBuf, _: String, _: Arc<ProgressFn>, _: Arc<Notify>) -> TrackFuture {
    Box::pin(async { Err(DownloadError::unknown("inert")) })
  }
}

fn app(config: Config) -> axum::Router {
  loupe_server::build_app(config, Arc::new(InertEngine))
}

/// A request as the local loupe web app would send it: loopback peer,
/// allowlisted Host, no Origin.
fn local_request(method: &str, uri: &str, body: Body) -> Request<Body> {
  Request::builder()
    .method(method)
    .uri(uri)
    .header("host", "localhost:6173")
    .extension(ConnectInfo(SocketAddr::from(([127, 0, 0, 1], 54321))))
    .body(body)
    .unwrap()
}

async fn body_bytes(response: axum::response::Response) -> Vec<u8> {
  response
    .into_body()
    .collect()
    .await
    .unwrap()
    .to_bytes()
    .to_vec()
}

#[tokio::test]
async fn health_answers_the_python_shape() {
  let dir = tempfile::tempdir().unwrap();
  let response = app(test_config(dir.path()))
    .oneshot(local_request("GET", "/health", Body::empty()))
    .await
    .unwrap();
  assert_eq!(response.status(), StatusCode::OK);
  let value: serde_json::Value = serde_json::from_slice(&body_bytes(response).await).unwrap();
  assert_eq!(
    value,
    serde_json::json!({"status": "ok", "model": null, "device": null})
  );
}

#[tokio::test]
async fn version_answers_the_binary_version() {
  let dir = tempfile::tempdir().unwrap();
  let response = app(test_config(dir.path()))
    .oneshot(local_request("GET", "/version", Body::empty()))
    .await
    .unwrap();
  assert_eq!(response.status(), StatusCode::OK);
  let value: serde_json::Value = serde_json::from_slice(&body_bytes(response).await).unwrap();
  assert_eq!(
    value,
    serde_json::json!({"version": env!("CARGO_PKG_VERSION")})
  );
}

#[tokio::test]
async fn refuses_a_non_loopback_peer_regardless_of_headers() {
  let dir = tempfile::tempdir().unwrap();
  let request = Request::builder()
    .uri("/health")
    .header("host", "localhost")
    .extension(ConnectInfo(SocketAddr::from(([192, 168, 1, 7], 40000))))
    .body(Body::empty())
    .unwrap();
  let response = app(test_config(dir.path())).oneshot(request).await.unwrap();
  assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn refuses_a_request_with_no_peer_information() {
  let dir = tempfile::tempdir().unwrap();
  let request = Request::builder()
    .uri("/health")
    .header("host", "localhost")
    .body(Body::empty())
    .unwrap();
  let response = app(test_config(dir.path())).oneshot(request).await.unwrap();
  assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn refuses_a_forged_host_header() {
  let dir = tempfile::tempdir().unwrap();
  let mut request = local_request("GET", "/health", Body::empty());
  request
    .headers_mut()
    .insert("host", "evil.example".parse().unwrap());
  let response = app(test_config(dir.path())).oneshot(request).await.unwrap();
  assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn refuses_a_foreign_origin_even_among_duplicates() {
  let dir = tempfile::tempdir().unwrap();
  let mut request = local_request("POST", "/gc-like", Body::empty());
  request
    .headers_mut()
    .append("origin", "http://localhost:5173".parse().unwrap());
  request
    .headers_mut()
    .append("origin", "http://evil.example".parse().unwrap());
  let response = app(test_config(dir.path())).oneshot(request).await.unwrap();
  assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn trusts_the_allowlisted_origin_and_the_servers_own() {
  let dir = tempfile::tempdir().unwrap();
  let config = test_config(dir.path());

  let mut request = local_request("GET", "/health", Body::empty());
  request
    .headers_mut()
    .insert("origin", "http://localhost:5173".parse().unwrap());
  let response = app(config.clone()).oneshot(request).await.unwrap();
  assert_eq!(response.status(), StatusCode::OK);

  // Same-origin (the pages we serve ourselves) — NOT in the allowlist above.
  let mut request = local_request("GET", "/health", Body::empty());
  request
    .headers_mut()
    .insert("origin", "http://localhost:6173".parse().unwrap());
  let response = app(config).oneshot(request).await.unwrap();
  assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn audio_roundtrip_is_content_addressed() {
  let dir = tempfile::tempdir().unwrap();
  let config = test_config(dir.path());

  let response = app(config.clone())
    .oneshot(local_request("POST", "/audio", Body::from("abc")))
    .await
    .unwrap();
  assert_eq!(response.status(), StatusCode::OK);
  let value: serde_json::Value = serde_json::from_slice(&body_bytes(response).await).unwrap();
  let reference = value["ref"].as_str().unwrap().to_owned();
  assert_eq!(
    reference,
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  );

  let response = app(config.clone())
    .oneshot(local_request(
      "GET",
      &format!("/audio/{reference}"),
      Body::empty(),
    ))
    .await
    .unwrap();
  assert_eq!(response.status(), StatusCode::OK);
  assert_eq!(
    response.headers()["content-type"],
    "application/octet-stream"
  );
  assert_eq!(body_bytes(response).await, b"abc");

  let response = app(config)
    .oneshot(local_request(
      "HEAD",
      &format!("/audio/{reference}"),
      Body::empty(),
    ))
    .await
    .unwrap();
  assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn unknown_and_malformed_refs_answer_404() {
  let dir = tempfile::tempdir().unwrap();
  let config = test_config(dir.path());
  let missing = "0".repeat(64);
  for uri in [format!("/audio/{missing}"), "/audio/not-a-ref".to_owned()] {
    let response = app(config.clone())
      .oneshot(local_request("GET", &uri, Body::empty()))
      .await
      .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND, "{uri}");
  }
}

#[tokio::test]
async fn refuses_an_upload_over_the_cap_and_a_store_past_quota() {
  let dir = tempfile::tempdir().unwrap();
  let config = test_config(dir.path());

  let oversized = vec![0u8; config.max_upload_bytes as usize + 1];
  let response = app(config.clone())
    .oneshot(local_request("POST", "/audio", Body::from(oversized)))
    .await
    .unwrap();
  assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);

  let mut quota_config = config;
  quota_config.max_audio_store_bytes = 4;
  let application = app(quota_config);
  let response = application
    .clone()
    .oneshot(local_request("POST", "/audio", Body::from("1234")))
    .await
    .unwrap();
  assert_eq!(response.status(), StatusCode::OK);
  let response = application
    .oneshot(local_request("POST", "/audio", Body::from("5678")))
    .await
    .unwrap();
  assert_eq!(response.status(), StatusCode::INSUFFICIENT_STORAGE);
}

#[tokio::test]
async fn unknown_paths_fall_through_to_a_web_404() {
  // web_dist/ is empty in dev/CI, so the fallback answers 404 — the API
  // serves alone, like the Python server without a dist.
  let dir = tempfile::tempdir().unwrap();
  let response = app(test_config(dir.path()))
    .oneshot(local_request("GET", "/nowhere", Body::empty()))
    .await
    .unwrap();
  assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

/// The happy-path engine: streams progress, writes the file where the real
/// engine would, reports the crate's contract values.
struct HappyEngine;

impl DownloadEngine for HappyEngine {
  fn download(
    &self,
    data_dir: PathBuf,
    _url: String,
    on_progress: Arc<ProgressFn>,
    _cancel: Arc<Notify>,
  ) -> TrackFuture {
    Box::pin(async move {
      on_progress("downloading", 0.0);
      on_progress("downloading", 0.5);
      let relative = "downloads/dl-test";
      let out_dir = data_dir.join(relative);
      std::fs::create_dir_all(&out_dir).map_err(|e| DownloadError::unknown(e.to_string()))?;
      std::fs::write(out_dir.join("track.m4a"), b"fake-audio")
        .map_err(|e| DownloadError::unknown(e.to_string()))?;
      on_progress("transcoding", 1.0);
      Ok(DownloadedTrack {
        relative_path: format!("{relative}/track.m4a"),
        title: "Titre".into(),
        duration_seconds: Some(12.5),
        uploader: Some("Chaîne".into()),
      })
    })
  }
}

struct FailingEngine;

impl DownloadEngine for FailingEngine {
  fn download(&self, _: PathBuf, url: String, _: Arc<ProgressFn>, _: Arc<Notify>) -> TrackFuture {
    Box::pin(async move {
      Err(DownloadError::new(
        DownloadErrorCode::Unsupported,
        format!("unsupported source URL: {url}"),
      ))
    })
  }
}

struct StuckEngine;

impl DownloadEngine for StuckEngine {
  fn download(&self, _: PathBuf, _: String, _: Arc<ProgressFn>, _: Arc<Notify>) -> TrackFuture {
    Box::pin(async {
      tokio::time::sleep(Duration::from_secs(3600)).await;
      Err(DownloadError::unknown("unreachable"))
    })
  }
}

fn download_request(url: &str) -> Request<Body> {
  let mut request = local_request(
    "POST",
    "/download",
    Body::from(serde_json::json!({ "url": url }).to_string()),
  );
  request
    .headers_mut()
    .insert("content-type", "application/json".parse().unwrap());
  request
}

async fn ndjson_lines(response: axum::response::Response) -> Vec<serde_json::Value> {
  assert_eq!(response.status(), StatusCode::OK);
  assert_eq!(response.headers()["content-type"], "application/x-ndjson");
  String::from_utf8(body_bytes(response).await)
    .unwrap()
    .lines()
    .map(|line| serde_json::from_str(line).unwrap())
    .collect()
}

#[tokio::test]
async fn download_streams_progress_then_parks_the_track_in_the_audio_store() {
  let dir = tempfile::tempdir().unwrap();
  let config = test_config(dir.path());
  let application = loupe_server::build_app(config.clone(), Arc::new(HappyEngine));

  let response = application
    .clone()
    .oneshot(download_request("https://youtube.com/watch?v=x"))
    .await
    .unwrap();
  let lines = ndjson_lines(response).await;

  assert_eq!(lines[0]["type"], "progress");
  assert_eq!(lines[0]["phase"], "downloading");
  let done = lines.last().unwrap();
  assert_eq!(done["type"], "done");
  assert_eq!(done["title"], "Titre");
  assert_eq!(done["duration"], 12.5);
  assert_eq!(done["uploader"], "Chaîne");
  assert!(lines.iter().any(|l| l["phase"] == "transcoding"));

  // The parked blob is fetchable from the SAME store, and the per-download
  // temp dir is gone.
  let reference = done["ref"].as_str().unwrap();
  let response = application
    .oneshot(local_request(
      "GET",
      &format!("/audio/{reference}"),
      Body::empty(),
    ))
    .await
    .unwrap();
  assert_eq!(body_bytes(response).await, b"fake-audio");
  assert!(!dir.path().join("downloads/dl-test").exists());
}

#[tokio::test]
async fn download_surfaces_engine_failures_as_an_ndjson_error_line() {
  let dir = tempfile::tempdir().unwrap();
  let application = loupe_server::build_app(test_config(dir.path()), Arc::new(FailingEngine));
  let response = application
    .oneshot(download_request("https://vimeo.com/1"))
    .await
    .unwrap();
  let lines = ndjson_lines(response).await;
  assert_eq!(lines.len(), 1);
  assert_eq!(lines[0]["type"], "error");
  // The code is the UI contract (AV.1); the raw message stays console-bound.
  assert_eq!(lines[0]["code"], "unsupported");
  assert!(lines[0]["message"]
    .as_str()
    .unwrap()
    .contains("unsupported source URL"));
}

#[tokio::test]
async fn download_times_out_on_a_wedged_engine() {
  let dir = tempfile::tempdir().unwrap();
  let mut config = test_config(dir.path());
  config.download_timeout = Duration::from_millis(50);
  let application = loupe_server::build_app(config, Arc::new(StuckEngine));
  let response = application
    .oneshot(download_request("https://youtube.com/watch?v=x"))
    .await
    .unwrap();
  let lines = ndjson_lines(response).await;
  assert_eq!(
    lines[0],
    serde_json::json!({"type": "error", "code": "timeout", "message": "download timed out"})
  );
}

#[tokio::test]
async fn download_reports_a_full_audio_store_as_the_store_quota_code() {
  let dir = tempfile::tempdir().unwrap();
  let mut config = test_config(dir.path());
  // Smaller than the fake track's bytes: parking the download must trip the
  // store quota, and the client copy switches on the code, not the message.
  config.max_audio_store_bytes = 4;
  let application = loupe_server::build_app(config, Arc::new(HappyEngine));
  let response = application
    .oneshot(download_request("https://youtube.com/watch?v=x"))
    .await
    .unwrap();
  let lines = ndjson_lines(response).await;
  let error = lines.last().unwrap();
  assert_eq!(error["type"], "error");
  assert_eq!(error["code"], "store-quota");
  assert!(error["message"].as_str().unwrap().contains("quota"));
}

#[tokio::test]
async fn download_refuses_a_body_that_is_not_json() {
  let dir = tempfile::tempdir().unwrap();
  let application = loupe_server::build_app(test_config(dir.path()), Arc::new(InertEngine));
  let response = application
    .oneshot(local_request("POST", "/download", Body::from("not json")))
    .await
    .unwrap();
  assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

fn put_project(id: &str, manifest: &str) -> Request<Body> {
  local_request(
    "PUT",
    &format!("/projects/{id}"),
    Body::from(manifest.to_owned()),
  )
}

#[tokio::test]
async fn project_crud_roundtrip_with_idempotent_delete() {
  let dir = tempfile::tempdir().unwrap();
  let config = test_config(dir.path());
  let manifest = serde_json::json!({"id": "p1", "name": "Song"});

  let response = app(config.clone())
    .oneshot(put_project("p1", &manifest.to_string()))
    .await
    .unwrap();
  assert_eq!(response.status(), StatusCode::NO_CONTENT);

  let response = app(config.clone())
    .oneshot(local_request("GET", "/projects/p1", Body::empty()))
    .await
    .unwrap();
  assert_eq!(response.status(), StatusCode::OK);
  assert_eq!(response.headers()["content-type"], "application/json");
  let value: serde_json::Value = serde_json::from_slice(&body_bytes(response).await).unwrap();
  assert_eq!(value, manifest);

  let response = app(config.clone())
    .oneshot(local_request("GET", "/projects", Body::empty()))
    .await
    .unwrap();
  assert_eq!(response.status(), StatusCode::OK);
  let listed: serde_json::Value = serde_json::from_slice(&body_bytes(response).await).unwrap();
  assert_eq!(listed, serde_json::json!([manifest]));

  let response = app(config.clone())
    .oneshot(local_request("DELETE", "/projects/p1", Body::empty()))
    .await
    .unwrap();
  assert_eq!(response.status(), StatusCode::NO_CONTENT);
  let response = app(config.clone())
    .oneshot(local_request("GET", "/projects/p1", Body::empty()))
    .await
    .unwrap();
  assert_eq!(response.status(), StatusCode::NOT_FOUND);
  // Delete is idempotent — deleting a gone project still succeeds.
  let response = app(config)
    .oneshot(local_request("DELETE", "/projects/p1", Body::empty()))
    .await
    .unwrap();
  assert_eq!(response.status(), StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn put_rejects_a_manifest_that_is_not_json() {
  let dir = tempfile::tempdir().unwrap();
  let response = app(test_config(dir.path()))
    .oneshot(put_project("p1", "{ not json"))
    .await
    .unwrap();
  assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn put_refuses_a_manifest_over_the_cap() {
  let dir = tempfile::tempdir().unwrap();
  let config = test_config(dir.path());
  let oversized = format!(
    r#"{{"pad":"{}"}}"#,
    "x".repeat(config.max_manifest_bytes as usize)
  );
  let response = app(config)
    .oneshot(put_project("p1", &oversized))
    .await
    .unwrap();
  assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
}

#[tokio::test]
async fn malformed_project_id_is_404() {
  let dir = tempfile::tempdir().unwrap();
  let config = test_config(dir.path());
  for method in ["GET", "PUT", "DELETE"] {
    let body = if method == "PUT" {
      Body::from("{}")
    } else {
      Body::empty()
    };
    let response = app(config.clone())
      .oneshot(local_request(method, "/projects/bad*id", body))
      .await
      .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND, "{method}");
  }
}

#[tokio::test]
async fn list_is_empty_then_skips_a_corrupt_manifest() {
  let dir = tempfile::tempdir().unwrap();
  let config = test_config(dir.path());

  let response = app(config.clone())
    .oneshot(local_request("GET", "/projects", Body::empty()))
    .await
    .unwrap();
  let listed: serde_json::Value = serde_json::from_slice(&body_bytes(response).await).unwrap();
  assert_eq!(listed, serde_json::json!([]));

  app(config.clone())
    .oneshot(put_project("good", r#"{"id":"good"}"#))
    .await
    .unwrap();
  std::fs::write(dir.path().join("projects/broken.json"), "{ nope").unwrap();
  let response = app(config)
    .oneshot(local_request("GET", "/projects", Body::empty()))
    .await
    .unwrap();
  let listed: serde_json::Value = serde_json::from_slice(&body_bytes(response).await).unwrap();
  assert_eq!(listed, serde_json::json!([{"id": "good"}]));
}

#[tokio::test]
async fn gc_sweeps_orphaned_blobs_and_reports_a_summary() {
  let dir = tempfile::tempdir().unwrap();
  let config = test_config(dir.path());

  // Park two blobs, then save a manifest referencing only the first.
  let response = app(config.clone())
    .oneshot(local_request("POST", "/audio", Body::from("kept")))
    .await
    .unwrap();
  let value: serde_json::Value = serde_json::from_slice(&body_bytes(response).await).unwrap();
  let kept_ref = value["ref"].as_str().unwrap().to_owned();
  app(config.clone())
    .oneshot(local_request("POST", "/audio", Body::from("orphan bytes")))
    .await
    .unwrap();
  app(config.clone())
    .oneshot(put_project(
      "p1",
      &serde_json::json!({"source": {"audioRef": kept_ref}}).to_string(),
    ))
    .await
    .unwrap();

  let response = app(config.clone())
    .oneshot(local_request("POST", "/gc", Body::empty()))
    .await
    .unwrap();
  assert_eq!(response.status(), StatusCode::OK);
  let summary: serde_json::Value = serde_json::from_slice(&body_bytes(response).await).unwrap();
  assert_eq!(
    summary,
    serde_json::json!({"deleted": 1, "reclaimedBytes": 12, "kept": 1})
  );

  // The referenced blob survived; the orphan is gone.
  let response = app(config)
    .oneshot(local_request(
      "GET",
      &format!("/audio/{kept_ref}"),
      Body::empty(),
    ))
    .await
    .unwrap();
  assert_eq!(body_bytes(response).await, b"kept");
}

#[tokio::test]
async fn boot_gc_sweeps_orphans_with_the_same_summary_shape() {
  // The binary's lifespan-parity sweep: same stores, same summary.
  let dir = tempfile::tempdir().unwrap();
  let config = test_config(dir.path());
  app(config.clone())
    .oneshot(local_request("POST", "/audio", Body::from("orphan bytes")))
    .await
    .unwrap();

  let summary = loupe_server::boot_gc(&config);

  assert_eq!(
    summary,
    serde_json::json!({"deleted": 1, "reclaimedBytes": 12, "kept": 0})
  );
}
