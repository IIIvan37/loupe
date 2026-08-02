/**
 * Presence heartbeat for the server shell (auto-exit contract): while a tab is
 * open, the app pings the serving binary so it knows someone is still there;
 * once every tab is gone the beats stop and the server shuts itself down
 * after its grace period. 20 s stays well inside Chrome's background-tab
 * throttling floor (one timer wake per minute) versus the server's 180 s
 * grace — a hidden tab never reads as a closed one.
 */
export const HEARTBEAT_INTERVAL_MS = 20_000

/** Start beating against `origin`; returns a stop function. A failed beat is
 * swallowed: the server being gone is exactly what silence means. */
export function startPresenceHeartbeat(origin: string): () => void {
  const id = setInterval(() => {
    fetch(`${origin}/heartbeat`, { method: 'POST' }).catch(() => {})
  }, HEARTBEAT_INTERVAL_MS)
  return () => clearInterval(id)
}
