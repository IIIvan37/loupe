/**
 * Where the analyses run — the three detections (structure, tempo, chords) and
 * separation, all on the Modal service (offload-only, Lot AJ). The endpoint is
 * **mandatory**: there is no local fallback anymore, so an unset
 * `VITE_ANALYSIS_URL` fails loud at composition time instead of silently
 * pointing at a dead `localhost`. The bearer gating the service is a
 * short-lived token minted per analysis — see `analysis-token.ts`.
 */
export function analysisUrl(): string {
  const url = import.meta.env.VITE_ANALYSIS_URL
  if (!url) {
    throw new Error(
      'VITE_ANALYSIS_URL is not configured — the analysis service endpoint is required.'
    )
  }
  return url
}
