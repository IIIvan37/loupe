/**
 * Whether an analysis run that has just come back from its port is still the
 * one to commit. Four hooks (tempo, chords, structure, separation) run the
 * same protocol — take a token, await the detector, commit — and each had
 * written its own guard; two of them weighed the token alone, so a track
 * imported during a run could inherit the previous track's result.
 */
export function isRunCurrent<Track>(run: {
  /** The token and the track as they stood when the run started. */
  readonly started: { readonly runId: number; readonly track: Track }
  /** The token and the track as they stand now, after the await. */
  readonly current: { readonly runId: number; readonly track: Track }
  /** Whether the run's own transfer was aborted (an abort is not an outcome). */
  readonly aborted: boolean
}): boolean {
  return (
    run.started.runId === run.current.runId &&
    run.started.track === run.current.track &&
    !run.aborted
  )
}
