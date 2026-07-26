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

use axum::body::Body;
use axum::http::{header, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use std::borrow::Cow;

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
    return (StatusCode::NOT_FOUND, "not found").into_response();
  };
  let mime = mime_guess::from_path(path).first_or_octet_stream();
  let body = match file.data {
    Cow::Borrowed(bytes) => Body::from(bytes),
    Cow::Owned(bytes) => Body::from(bytes),
  };
  ([(header::CONTENT_TYPE, mime.as_ref())], body).into_response()
}
