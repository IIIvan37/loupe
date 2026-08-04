/**
 * The transport failures every remote-analysis flow shares (tempo, chords,
 * structure, separation), named after what the user can act on: server up but
 * engine missing, network unreachable, analysis timed out, upload over the
 * server's cap. Each flow's error code composes this union with its own
 * domain outcomes — a new transport code (an auth failure, a quota refusal)
 * lands HERE once and every flow inherits it, instead of a hand-copied edit
 * across four unions and their error classes.
 */
export type AnalysisTransportErrorCode =
  | 'engine-unavailable'
  | 'network'
  | 'timeout'
  | 'too-large'
