/**
 * Resolve after the browser has PAINTED the current state — a double
 * requestAnimationFrame (the first fires before paint, the second after).
 * Used to let a busy line appear before a synchronous freeze (zip encode,
 * WAV re-encode) blocks the main thread (R.4): nothing paints under a
 * blocked thread, so the yield must come between the setState and the work.
 */
export function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}
