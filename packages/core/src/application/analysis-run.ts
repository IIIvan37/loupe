/**
 * Whether an analysis run that has just come back from its port is still the
 * one to commit. Four hooks (tempo, chords, structure, separation) run the
 * same protocol — take a token, await the detector, commit — and each had
 * written its own guard; two of them weighed the token alone, so a track
 * imported during a run could inherit the previous track's result.
 *
 * `started` is the token and the track as they stood when the run began,
 * `current` as they stand now. The comparison is symmetric, so the order of
 * the two carries no meaning beyond reading order.
 */
export function isRunCurrent<Track>(
  started: { readonly runId: number; readonly track: Track },
  current: { readonly runId: number; readonly track: Track },
  /** Whether the run's own transfer was aborted (an abort is not an outcome). */
  aborted: boolean
): boolean {
  return (
    started.runId === current.runId &&
    started.track === current.track &&
    !aborted
  )
}
