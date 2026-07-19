/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The Modal analysis service endpoint — mandatory in a shipped build (all
   * analyses run there; offload-only, Lot AJ). Unset only in dev/tests. */
  readonly VITE_ANALYSIS_URL?: string
  /** Supabase project URL (auth + the mint-analyze-token Edge Function). */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon key — public by design (RLS enforces access, not secrecy). */
  readonly VITE_SUPABASE_ANON_KEY?: string
}
