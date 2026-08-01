//! Network trust boundary — the three guards of `server/app/netguard.py` and
//! `main.py`'s middleware onion, ported to axum. Pure predicates behind thin
//! `from_fn` middlewares, unit-testable without a socket.
//!
//! - Loopback-only (outermost): refuse any connection whose PEER address is
//!   not loopback. The Python guard inspects the local socket address (what
//!   ASGI exposes); hyper hands us the peer address instead — equivalent
//!   closure: a LAN client's peer IP is never loopback, so a `0.0.0.0` bind
//!   mistake still can't expose the server even with a forged Host header.
//! - Trusted host: the Host header must be allowlisted (DNS rebinding — a
//!   hostile name resolving to 127.0.0.1 carries its own Host, refused here).
//! - Origin guard: CORS stops a foreign page from *reading* us, not from
//!   *sending* — a "simple request" POST needs no preflight. Any request
//!   carrying an Origin outside the allowlist is refused; no Origin (curl,
//!   native clients) is not browser-mediated CSRF and passes. Every Origin
//!   value is checked (a last-wins parse would let a smuggled one ride
//!   along); the server's own origin — pages we serve ourselves — is trusted.

use crate::config::Config;
use axum::extract::{ConnectInfo, Request, State};
use axum::http::{header, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use std::net::SocketAddr;
use std::sync::Arc;

/// The hostname part of a Host header value: strips `:port`, bracket-aware
/// (`[::1]:6173` → `[::1]`) so an IPv6 host never truncates at its first `:`.
pub fn host_without_port(host: &str) -> &str {
  if host.starts_with('[') {
    if let Some(end) = host.find(']') {
      return &host[..=end];
    }
  }
  host.split(':').next().unwrap_or(host)
}

/// True iff the Host header names an allowlisted host (or the list holds the
/// explicit `*` opt-out, as Starlette's TrustedHostMiddleware honours it).
/// Entries match verbatim — no partial wildcards.
pub fn is_allowed_host(host: Option<&str>, allowed: &[String]) -> bool {
  let Some(host) = host else {
    return false;
  };
  let name = host_without_port(host);
  allowed.iter().any(|entry| entry == "*" || entry == name)
}

/// True iff the Origin is a loopback page on some port —
/// `http://localhost:<port>` / `http://127.0.0.1:<port>`. The hand-rolled
/// twin of `origins.py`'s LOCAL_ORIGIN_PATTERN (AU.2): `loupe --port 7000`
/// must reach every surface without an env change.
fn is_local_origin(origin: &str) -> bool {
  let Some(rest) = origin.strip_prefix("http://") else {
    return false;
  };
  let port = rest
    .strip_prefix("localhost:")
    .or_else(|| rest.strip_prefix("127.0.0.1:"));
  match port {
    Some(digits) => {
      !digits.is_empty() && digits.len() <= 5 && digits.bytes().all(|b| b.is_ascii_digit())
    }
    None => false,
  }
}

/// True iff the request is not browser-mediated (no Origin) or the Origin is
/// allowlisted — a loopback page on ANY port counts (`loupe --port`, AU.2).
/// `null` (sandboxed iframe, file://) and `""` are foreign.
pub fn is_allowed_origin(origin: Option<&str>, allowed: &[String]) -> bool {
  match origin {
    None => true,
    Some(origin) => allowed.iter().any(|entry| entry == origin) || is_local_origin(origin),
  }
}

pub async fn loopback_only(request: Request, next: Next) -> Response {
  let peer_is_loopback = request
    .extensions()
    .get::<ConnectInfo<SocketAddr>>()
    .is_some_and(|info| info.0.ip().is_loopback());
  if !peer_is_loopback {
    return (StatusCode::FORBIDDEN, "loopback only").into_response();
  }
  next.run(request).await
}

pub async fn trusted_host(
  State(config): State<Arc<Config>>,
  request: Request,
  next: Next,
) -> Response {
  let host = request
    .headers()
    .get(header::HOST)
    .and_then(|value| value.to_str().ok());
  if !is_allowed_host(host, &config.allowed_hosts) {
    return (StatusCode::BAD_REQUEST, "invalid host header").into_response();
  }
  next.run(request).await
}

pub async fn origin_guard(
  State(config): State<Arc<Config>>,
  request: Request,
  next: Next,
) -> Response {
  // This server only ever speaks plain http on the loopback, so its own
  // origin is `http://<host>`; a browser's Origin is not forgeable and
  // TrustedHost has already vetted the Host header.
  let own = request
    .headers()
    .get(header::HOST)
    .and_then(|value| value.to_str().ok())
    .map(|host| format!("http://{host}"));
  for value in request.headers().get_all(header::ORIGIN) {
    // A non-ASCII Origin can't match any allowlist entry: foreign.
    let origin = value.to_str().ok();
    if origin.is_some() && origin == own.as_deref() {
      continue;
    }
    if !is_allowed_origin(Some(origin.unwrap_or("")), &config.allowed_origins) {
      return (StatusCode::FORBIDDEN, "origin not allowed").into_response();
    }
  }
  next.run(request).await
}

#[cfg(test)]
mod tests {
  use super::*;

  fn owned(items: &[&str]) -> Vec<String> {
    items.iter().map(|s| (*s).to_owned()).collect()
  }

  #[test]
  fn strips_the_port_but_never_truncates_an_ipv6_host() {
    assert_eq!(host_without_port("localhost:6173"), "localhost");
    assert_eq!(host_without_port("localhost"), "localhost");
    assert_eq!(host_without_port("[::1]:6173"), "[::1]");
    assert_eq!(host_without_port("[::1]"), "[::1]");
  }

  #[test]
  fn allows_only_listed_hosts_and_requires_the_header() {
    let allowed = owned(&["localhost", "127.0.0.1"]);
    assert!(is_allowed_host(Some("localhost:6173"), &allowed));
    assert!(is_allowed_host(Some("127.0.0.1"), &allowed));
    assert!(!is_allowed_host(Some("evil.example"), &allowed));
    assert!(!is_allowed_host(None, &allowed));
    assert!(is_allowed_host(Some("evil.example"), &owned(&["*"])));
  }

  #[test]
  fn accepts_a_loopback_origin_on_any_port() {
    // `loupe --port 7000` (AU.2): the user's own machine passes by pattern —
    // same acceptance as `origins.py` / the Deno mirror.
    let allowed = owned(&["http://localhost:5173"]);
    assert!(is_allowed_origin(Some("http://localhost:7000"), &allowed));
    assert!(is_allowed_origin(Some("http://127.0.0.1:65535"), &allowed));
    assert!(!is_allowed_origin(Some("https://localhost:7000"), &allowed));
    assert!(!is_allowed_origin(
      Some("http://localhost.evil.example:7000"),
      &allowed
    ));
    assert!(!is_allowed_origin(
      Some("http://localhost:7000/path"),
      &allowed
    ));
    assert!(!is_allowed_origin(Some("http://localhost:"), &allowed));
    assert!(!is_allowed_origin(Some("http://localhost"), &allowed));
  }

  #[test]
  fn passes_no_origin_and_refuses_foreign_null_and_empty() {
    let allowed = owned(&["http://localhost:5173"]);
    assert!(is_allowed_origin(None, &allowed));
    assert!(is_allowed_origin(Some("http://localhost:5173"), &allowed));
    assert!(!is_allowed_origin(Some("http://evil.example"), &allowed));
    assert!(!is_allowed_origin(Some("null"), &allowed));
    assert!(!is_allowed_origin(Some(""), &allowed));
  }
}
