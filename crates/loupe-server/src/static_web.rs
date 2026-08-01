//! The served web app, embedded at build time (`rust-embed`) so the binary
//! and its UI can never drift apart — the D4.b answer to the wheel's
//! `app/web_dist/` copy. `scripts/build-loupe-binary.sh` populates
//! `crates/loupe-server/web_dist/` with the server-shell dist before a
//! release build; without it (dev, CI) the folder is empty and the API
//! serves alone, exactly like the Python server without a dist.
//!
//! Mounted as the router fallback, so every API route wins. Exact files
//! only, `/` → `index.html` — same behaviour as `StaticFiles(html=True)` for
//! a single-page app that does no client-side routing.
//!
//! Every response carries the security and cache headers (AW.1): the CSP
//! that died with the Tauri webview (AC.2), nosniff, and a cache policy
//! split by fingerprinting — a stale `index.html` after a binary update
//! would name asset hashes that no longer exist.

use axum::body::Body;
use axum::http::{header, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use std::borrow::Cow;

/// The SPA's Content-Security-Policy — the Tauri AC.2 policy carried over,
/// with connect-src bounded to the backends the app actually calls: its own
/// origin, loopback harnesses (any port, the lot-AU pattern), Modal for
/// analyses and Supabase for auth. `https:` at large would readmit
/// exfiltration to arbitrary hosts.
const CSP: &str = "default-src 'self'; script-src 'self'; \
connect-src 'self' http://localhost:* http://127.0.0.1:* \
https://*.modal.run https://*.supabase.co; \
img-src 'self' blob: data:; media-src 'self' blob:; \
style-src 'self' 'unsafe-inline'; font-src 'self' data:; \
worker-src 'self' blob:; object-src 'none'; base-uri 'self'; \
frame-src 'none'; frame-ancestors 'none'";

#[derive(rust_embed::RustEmbed)]
#[folder = "web_dist/"]
struct WebDist;

pub async fn serve(uri: Uri) -> Response {
  let trimmed = uri.path().trim_start_matches('/');
  let path = if trimmed.is_empty() {
    "index.html"
  } else {
    trimmed
  };
  let Some(file) = WebDist::get(path) else {
    return (
      StatusCode::NOT_FOUND,
      [(header::X_CONTENT_TYPE_OPTIONS, "nosniff")],
      "not found",
    )
      .into_response();
  };
  let body = match file.data {
    Cow::Borrowed(bytes) => Body::from(bytes),
    Cow::Owned(bytes) => Body::from(bytes),
  };
  respond(path, body)
}

/// Headers + body for one embedded file. Public so the header contract can
/// be pinned by `tests/app.rs` even though `web_dist/` is empty in dev/CI.
pub fn respond(path: &str, body: Body) -> Response {
  let mime = mime_guess::from_path(path).first_or_octet_stream();
  (
    [
      (header::CONTENT_TYPE, mime.as_ref()),
      (header::CONTENT_SECURITY_POLICY, CSP),
      (header::X_CONTENT_TYPE_OPTIONS, "nosniff"),
      (header::CACHE_CONTROL, cache_control(path)),
    ],
    body,
  )
    .into_response()
}

/// Vite fingerprints everything under `assets/` (name changes when bytes
/// do), so those cache for a year; the document and any root-level file keep
/// their names across releases and must revalidate on every load.
fn cache_control(path: &str) -> &'static str {
  if path.starts_with("assets/") {
    "public, max-age=31536000, immutable"
  } else {
    "no-cache"
  }
}
