import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Fitness function for the browser-origin allowlist.
 *
 * ONE allowlist gates three surfaces in three runtimes, each with its own
 * copy of the default (`LOUPE_ALLOWED_ORIGINS` overrides it wholesale):
 *
 * - `server/app/origins.py` — the Modal deployment + the local analysis
 *   harness (Python).
 * - `crates/loupe-server/src/config.rs` — the distributed `loupe` binary
 *   (Rust).
 * - `supabase/functions/mint-analyze-token/index.ts` — the token-minting
 *   Edge Function (Deno).
 *
 * A copy that drifts fails silently in production: the surface with the stale
 * default refuses (or CORS-blinds) an origin the others accept. This spec
 * extracts the three literals and refuses the drift at gate time instead.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function extractOrigins(path: string, pattern: RegExp): string[] {
  const source = readFileSync(join(ROOT, path), 'utf8')
  const match = source.match(pattern)
  if (!match?.[1]) {
    throw new Error(`DEFAULT_ALLOWED_ORIGINS not found in ${path}`)
  }
  return match[1]
    .replace(/\\\n\s*/g, '') // Rust string-literal line continuation
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '')
}

const python = () =>
  extractOrigins(
    'server/app/origins.py',
    /DEFAULT_ALLOWED_ORIGINS = \(\s*"([^"]+)"\s*\)/
  )

const rust = () =>
  extractOrigins(
    'crates/loupe-server/src/config.rs',
    /DEFAULT_ALLOWED_ORIGINS: &str =\s*"([\s\S]*?)";/
  )

const deno = () =>
  extractOrigins(
    'supabase/functions/mint-analyze-token/index.ts',
    /DEFAULT_ALLOWED_ORIGINS =\s*'([^']+)'/
  )

describe('default allowed-origins parity (Python ↔ Rust ↔ Deno)', () => {
  it('keeps the Rust binary default identical to the Python default', () => {
    expect(rust()).toEqual(python())
  })

  it('keeps the Deno Edge Function default identical to the Python default', () => {
    expect(deno()).toEqual(python())
  })

  it('covers both client ports (5173 Vite dev, 6173 loupe binary)', () => {
    expect(python()).toContain('http://localhost:5173')
    expect(python()).toContain('http://localhost:6173')
  })
})
