import { SERVER_URL } from '../projects/server-url.ts'

/**
 * Where GPU inference (structure…) runs. Points at the Modal endpoint when
 * `VITE_STRUCTURE_URL` is set (the offload — J1), otherwise the local server.
 * Storage and download never come here: they stay local (rights).
 */
export const ANALYSIS_URL: string =
  import.meta.env.VITE_STRUCTURE_URL ?? SERVER_URL

/**
 * The bearer gating the Modal endpoint, read at RUNTIME — never a build-time
 * public env, because a token inlined into the browser bundle is extractable
 * (and the security gate rightly refuses a secret-named `VITE_*`). J1 MVP: a dev
 * seeds it once via `localStorage.setItem('loupe.modal.token', '<token>')`. J2
 * replaces this with a Supabase-minted short-lived token. Undefined (absent, or
 * no `localStorage`) → the token-less local server, no `Authorization` sent.
 */
export function analysisToken(): string | undefined {
  try {
    return localStorage.getItem('loupe.modal.token') ?? undefined
  } catch {
    return undefined
  }
}
