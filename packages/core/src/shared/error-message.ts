/** Normalise a thrown value into the human-readable message a `Result` carries. */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
