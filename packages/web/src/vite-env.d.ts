/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the local Demucs separation server (`http` engine). */
  readonly VITE_SEPARATOR_URL?: string
  /** GPU inference endpoint (Modal offload). When set, analysis is gated. */
  readonly VITE_STRUCTURE_URL?: string
  /** Supabase project URL (auth + the mint-analyze-token Edge Function). */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon key — public by design (RLS enforces access, not secrecy). */
  readonly VITE_SUPABASE_ANON_KEY?: string
}
