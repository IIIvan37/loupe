//! Auto-exit presence: the server lives as long as a tab talks to it.
//!
//! The served web app beats `POST /heartbeat` every 20 s
//! (`packages/web/src/lib/presence-heartbeat.ts`); a middleware stamps
//! `last_seen` on every vetted request (heartbeats included — a foreign
//! request rejected by the netguards never counts as presence). The watchdog
//! exits once the stamp is older than the grace AND no download is in flight:
//! a closed tab must never kill the yt-dlp stream it just started.
//!
//! The grace (180 s by default) rides well above Chrome's background-tab
//! throttling floor (one timer wake per minute), so a hidden tab keeps its
//! server; and `tokio::time::Instant` is monotonic, so a laptop asleep burns
//! none of it.

use crate::AppState;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware::Next;
use axum::response::Response;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::time::Instant;

/// When the serving process last heard from a client.
pub struct Presence {
  last_seen: Mutex<Instant>,
}

impl Default for Presence {
  fn default() -> Self {
    Self {
      // Boot counts as presence: the browser gets the whole grace to open.
      last_seen: Mutex::new(Instant::now()),
    }
  }
}

impl Presence {
  pub fn touch(&self) {
    *self.last_seen.lock().expect("presence lock poisoned") = Instant::now();
  }

  pub fn idle_for(&self) -> Duration {
    self
      .last_seen
      .lock()
      .expect("presence lock poisoned")
      .elapsed()
  }
}

/// Stamp presence on every request that made it past the netguards.
pub async fn touch_on_request(
  State(state): State<Arc<AppState>>,
  request: axum::extract::Request,
  next: Next,
) -> Response {
  state.presence.touch();
  next.run(request).await
}

/// The tab's keep-alive. The touch itself happens in the middleware; the
/// route only gives the beat a vetted, cache-proof landing spot.
pub async fn heartbeat() -> StatusCode {
  StatusCode::NO_CONTENT
}

/// Resolve once the workshop should exit: nobody has talked for `grace` and
/// no download holds a slot. Polls on `grace / 6` — precision is irrelevant,
/// only the order of magnitude matters.
pub async fn auto_exit(state: Arc<AppState>, grace: Duration) {
  let poll = grace / 6;
  loop {
    tokio::time::sleep(poll).await;
    let downloads_idle = state.download_slots.available_permits() == state.config.download_slots;
    if downloads_idle && state.presence.idle_for() >= grace {
      return;
    }
  }
}
