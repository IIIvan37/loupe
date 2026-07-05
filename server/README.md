# loupe server

The local backend for loupe: hosts project storage and the heavy audio jobs the
browser can't do well — **Demucs** separation, **librosa** tempo detection, and
**yt-dlp** URL download. Its headline job runs the full **Demucs `htdemucs_6s`**
model (PyTorch, GPU when available) and streams stems back to the web app. It
exists because the in-browser WASM engines hit a quality/speed wall — server-side
PyTorch has no such ceiling. The 6-source model splits **guitar** and **piano**
out of the "other" bucket, so the app's adaptive detection can surface only the
instruments actually present. Override the model with `DEMUCS_MODEL` (e.g.
`htdemucs` for the faster 4-stem model, or `htdemucs_ft`, the slower fine-tuned bag).

This is a standalone Python service, **deliberately outside the pnpm monorepo /
hexagon**. The web app talks to it only through the HTTP contract below, behind
the `StemSeparator` port — so it could be reimplemented in any language without
the web side noticing.

## Run

```sh
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

First run downloads the model weights (~hundreds of MB). The best available
device is picked automatically — CUDA, then Apple GPU (MPS), then CPU (still well
ahead of the browser).

Point the web app at it:

```sh
VITE_SEPARATOR_URL=http://localhost:8000 pnpm --filter @app/web dev
```

(Defaults to `http://localhost:8000` when the variable is unset.)

### One command (server + web)

Once the venv exists (the `python -m venv .venv && pip install …` step above),
launch both from the repo root:

```sh
pnpm dev          # = concurrently: dev:server (uvicorn) + dev:web (Vite)
```

`pnpm dev:server` / `pnpm dev:web` run them individually. `dev:server` calls the
venv's uvicorn directly (`server/.venv/bin/uvicorn`), so the venv must
be set up first.

## HTTP contract

| Endpoint | Description |
| --- | --- |
| `POST /separate` | Body = mix as a 16-bit PCM WAV (`audio/wav`). Responds `application/x-ndjson`, one JSON object per line. |
| `GET /stems/{job}/{stem}.wav` | The isolated stem produced by a prior `/separate`. |
| `POST /tempo` | Body = mix as a 16-bit PCM WAV (`audio/wav`). Responds `application/json`: `{"bpm": float, "beats": [seconds, …]}` from a librosa beat tracker. Independent of the Demucs stack — needs only librosa; a host without it answers `503`. |
| `POST /audio`, `GET`/`HEAD /audio/{ref}`, `GET`/`PUT`/`DELETE /projects/{id}`, `GET /projects` | Project storage — content-addressed audio blobs + opaque JSON manifests (the core's `ProjectStore` / `ProjectAudioStore` ports). Always on, no ML stack needed. See `app/projects.py`. |
| `POST /gc` | Reclaim orphaned audio blobs — scans every manifest for referenced refs and deletes the blobs none point at. Responds `{"deleted", "reclaimedBytes", "kept"}` (or `{"skipped": true, …}` if a manifest is unreadable — it never deletes on incomplete info). Also runs automatically on server boot. Run when idle. |
| `GET /health` | Liveness + which model/device is loaded. |

`/separate` streamed lines:

```json
{"type":"progress","phase":"analysing","fraction":0}
{"type":"progress","phase":"separating","fraction":0.42}
{"type":"done","stems":[{"id":"voix","label":"Voix","url":"http://localhost:8000/stems/<job>/voix.wav"}]}
```

…or `{"type":"error","message":"..."}` on failure.

Stem ids/labels (`voix`, `batterie`, `basse`, `autres`) match the core's
`stem-layout`, so the server's output drops straight into the existing UI.

## Notes

- `separating` progress is derived from Demucs' internal per-segment tqdm bar
  (one update per audio segment), so granularity scales with track length.
- Stem jobs are written to a **private** (`0700`) dir under the OS temp dir and
  swept by age on each separation (`LOUPE_STEMS_TTL_SECONDS`, default `3600`), so
  WAVs don't accumulate and other local users can't read them.
- No auth / rate limiting: intended for `localhost` only. Guards enforce that
  trust model, all env-overridable but locked down by default:
  - **CORS** is scoped to the dev origin (`LOUPE_ALLOWED_ORIGINS`, default
    `http://localhost:5173,http://127.0.0.1:5173`), never `*` — a random page in
    the same browser can't read our responses.
  - **Host** header is validated (`LOUPE_ALLOWED_HOSTS`, default
    `localhost,127.0.0.1`) to blunt DNS-rebinding. Point the web app elsewhere by
    setting both vars; never bind `--host 0.0.0.0` (an unauthenticated,
    file-writing server on the LAN).
  - **Body-size caps** refuse oversized uploads before buffering
    (`LOUPE_MAX_UPLOAD_MB`, default `500`, for audio/`/separate`/`/tempo`;
    `LOUPE_MAX_MANIFEST_MB`, default `16`, for manifests) → 413.
  - **/separate concurrency** is bounded (`LOUPE_MAX_CONCURRENT_SEPARATIONS`,
    default `1`) so parallel inferences can't thrash the device.
  - Client error messages are generic; full detail is logged server-side.
- Orphaned audio blobs (from re-saves and project deletes) are reclaimed by the
  manifest-scan GC — automatically on boot, or on demand via `POST /gc`.
- Tests: `pip install -r requirements-dev.txt` then `.venv/bin/python -m pytest`
  (covers storage/GC, CORS+Host, body caps, and the stem store — all torch-free;
  the ML inference itself stays manual).
