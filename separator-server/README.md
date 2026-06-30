# loupe separator-server

A local separation backend for loupe: runs the full **Demucs `htdemucs`**
model (PyTorch, GPU when available) and streams stems back to the web app. It
exists because the in-browser WASM engines hit a quality/speed wall — server-side
PyTorch has no such ceiling. Override the model with `DEMUCS_MODEL` (e.g.
`htdemucs_ft`, the slower 4-model fine-tuned bag).

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

## HTTP contract

| Endpoint | Description |
| --- | --- |
| `POST /separate` | Body = mix as a 16-bit PCM WAV (`audio/wav`). Responds `application/x-ndjson`, one JSON object per line. |
| `GET /stems/{job}/{stem}.wav` | The isolated stem produced by a prior `/separate`. |
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
- Jobs are written under the OS temp dir and live until the process exits — fine
  for single-user localhost; add cleanup/TTL before any shared deployment.
- No auth / rate limiting: intended for `localhost` only.
