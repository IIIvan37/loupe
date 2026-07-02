/**
 * Base URL of the local loupe server — one FastAPI process serving project
 * storage, Demucs separation and `/health`. Pointed at with
 * `VITE_SEPARATOR_URL` (defaults to `http://localhost:8000`).
 */
export const SERVER_URL: string =
  import.meta.env.VITE_SEPARATOR_URL ?? 'http://localhost:8000'
