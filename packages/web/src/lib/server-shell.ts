/**
 * True when this build is the dist served by the local loupe server
 * (distribution plan, D1): baked at build time via `VITE_SHELL=server`,
 * never probed at runtime. In that mode the backend IS the serving origin —
 * adapters talk same-origin, no CORS, no configured base URL.
 */
export function isServerShell(): boolean {
  return import.meta.env.VITE_SHELL === 'server'
}
