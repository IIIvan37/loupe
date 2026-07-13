import { SERVER_URL } from '../projects/server-url.ts'

/**
 * Where GPU inference (structure…) runs. Points at the Modal endpoint when
 * `VITE_STRUCTURE_URL` is set (the offload — J1), otherwise the local server.
 * Storage and download never come here: they stay local (rights). The bearer
 * gating the Modal endpoint is a short-lived token minted per analysis — see
 * `analysis-token.ts` (J2, replacing J1's static localStorage token).
 */
export const ANALYSIS_URL: string =
  import.meta.env.VITE_STRUCTURE_URL ?? SERVER_URL
