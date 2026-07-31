# loupe server — the analysis library

The analysis library the **Modal** deployment imports (`modal_app.py`), plus a
local FastAPI harness to exercise it in dev/CI. It hosts the heavy audio jobs
the browser can't do well — **Demucs** separation, **beat_this** tempo/beat
detection, **BTC** chord estimation and **SongFormer** structure detection. Its
headline job runs the full **Demucs `htdemucs_6s`** model (PyTorch, GPU when
available) and streams stems back. It exists because the in-browser WASM
engines hit a quality/speed wall — server-side PyTorch has no such ceiling.
The 6-source model splits **guitar** and **piano** out of the "other" bucket,
so the app's adaptive detection can surface only the instruments actually
present. Override the model with `DEMUCS_MODEL` (e.g. `htdemucs` for the
faster 4-stem model, or `htdemucs_ft`, the slower fine-tuned bag).

**Analysis only.** Project storage, URL download (yt-dlp) and serving the web
app live in the Rust `loupe` binary (`crates/loupe-server`) — the only
deliverable (see `docs/RELEASING.md`). In production the web app calls these
endpoints on Modal (`VITE_ANALYSIS_URL`), never on a local Python process.

This is a standalone Python tree, **deliberately outside the pnpm monorepo /
hexagon**. The web app talks to it only through the HTTP contract below,
behind ports (`StemSeparator`, the detector ports) — so it could be
reimplemented in any language without the web side noticing.

### Convention — humble objects

The server is an **adapter**, not a hexagon, so its discipline isn't "pure domain"
but the **humble object** pattern: the *decidable* logic — validation, policy,
parsing, naming/ordering, math — lives in **torch-free modules** that are
unit-tested and type-checked (`limits`, `netguard`, `origins`, `stems_store`,
`stem_manifest`, `beat_positions`, `chord_spans`, `structure_chunks`,
`structure_segments`, `weights_cache`, `wav_decode`).
The modules that import the heavy stacks (`separation.py` → torch/demucs,
`tempo.py` → torch/beat_this, `chords.py` → torch/vendored BTC,
`structure.py` → torch/vendored SongFormer) stay **thin shells**: decode →
call the library → hand the result to a pure helper → write. They're excluded
from pyright + coverage and verified manually. **When you add server logic,
put the decidable part in a torch-free module** — don't grow the ML shells.
It's what keeps the fast, torch-free CI meaningful.

## Run (dev/CI host, full ML)

```sh
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000        # or, from the repo root: pnpm dev:analysis
```

First run downloads the model weights (~hundreds of MB). The best available
device is picked automatically — CUDA, then Apple GPU (MPS), then CPU (still well
ahead of the browser).

Weights pinning is deliberately asymmetric: the **BTC** chord checkpoint is
fetched by *our* code, so it goes through `weights_cache.pinned_weights` —
sha256-pinned and re-hashed on every load before `torch.load` unpickles it.
**Demucs** and **beat_this** fetch their own checkpoints through their
libraries' loaders (torch hub–style caches we don't control); pinning those
would mean re-implementing each library's download path, so their integrity
is delegated to the upstream package + HTTPS. Routing beat_this through
`pinned_weights` stays on the table if its loader ever exposes a
checkpoint-path hook.

## HTTP contract

| Endpoint | Description |
| --- | --- |
| `POST /separate` | Body = mix as a 16-bit PCM WAV (`audio/wav`). Responds `application/x-ndjson`, one JSON object per line. |
| `GET /stems/{job}/{stem}.wav` | The isolated stem produced by a prior `/separate`. |
| `POST /tempo` | Body = mix as a 16-bit PCM WAV (`audio/wav`). Responds `application/json`: `{"bpm": float, "beats": [{"time": seconds, "position": n}, …]}` — `position` numbers each beat within its bar (`1` = downbeat), from CPJKU's **beat_this** transformer (beats *and* downbeats). Needs torch + beat_this; a host without them answers `503`. Checkpoint via `LOUPE_TEMPO_CHECKPOINT` (default `final0`; `small0` is lighter), device via `LOUPE_TEMPO_DEVICE`. |
| `POST /chords` | Body = mix as a 16-bit PCM WAV (`audio/wav`). Responds `application/json`: `{"chords": [{"start": s, "end": s, "label": "A:min"}, …]}` — timestamped chord spans (mir syntax, 25-class maj-min, `N` = no chord; **not** beat-synchronised — folding onto the beat grid is the web core's job), from the vendored **BTC** transformer (Park et al., ISMIR 2019, MIT, `app/btc/`). Needs torch; a host without it answers `503`. Weights (~33 MB) are fetched once to `~/.cache/loupe/btc/` and **sha256-pinned** before `torch.load` ever unpickles them; point `LOUPE_CHORDS_CHECKPOINT` at a local copy to skip the download, device via `LOUPE_CHORDS_DEVICE` (default `cpu` — ~2.4 s for a 4-minute song). |
| `POST /structure` | Body = mix as a 16-bit PCM WAV (`audio/wav`). Responds `application/json`: functional segments (intro/verse/chorus…) from the vendored **SongFormer** stack (`app/songformer/`), chunked inference. Needs torch + its SSL backbones; a host without them answers `503`. |
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

- On Modal the same routers are gated by a short-lived JWT + quota
  (`analyze_gate.py` / `analyze_auth.py`, ADR 0007) — the local harness mounts
  them ungated behind the loopback guards below.
- `separating` progress is derived from Demucs' internal per-segment tqdm bar
  (one update per audio segment), so granularity scales with track length.
- Stem jobs are written to a **private** (`0700`) dir under the OS temp dir and
  swept by age on each separation (`LOUPE_STEMS_TTL_SECONDS`, default `3600`), so
  WAVs don't accumulate and other local users can't read them.
- No auth / rate limiting locally: intended for `localhost` only. Guards enforce
  that trust model, all env-overridable but locked down by default:
  - **CORS** is scoped to the dev origin (`LOUPE_ALLOWED_ORIGINS`, default
    `http://localhost:5173,http://127.0.0.1:5173`), never `*` — a random page in
    the same browser can't read our responses.
  - **Origin guard** (CSRF): CORS blocks *reads*, not *sends* — a foreign
    page could still fire a preflight-free `text/plain` POST at the inference
    endpoints. Any request bearing an `Origin` outside
    `LOUPE_ALLOWED_ORIGINS` is refused (403); no Origin (curl, native
    clients) passes.
  - **Host** header is validated (`LOUPE_ALLOWED_HOSTS`, default
    `localhost,127.0.0.1`) to blunt DNS-rebinding. Point the web app elsewhere by
    setting both vars.
  - **Loopback-only**: requests that didn't land on the loopback interface are
    refused (403), read from the actual local socket — so a `--host 0.0.0.0`
    mistake can't expose the server to the LAN even with a forged Host header.
  - **Body-size caps** refuse oversized uploads before buffering
    (`LOUPE_MAX_UPLOAD_MB`, default `500`) → 413.
  - **Inference concurrency** is bounded (`LOUPE_MAX_CONCURRENT_SEPARATIONS` /
    `LOUPE_MAX_CONCURRENT_TEMPO` / `LOUPE_MAX_CONCURRENT_CHORDS`, default `1`
    each) so parallel inferences can't thrash the device. `/separate` also has
    a total wall-clock budget (`LOUPE_SEPARATION_TIMEOUT_SECONDS`, default
    `1800`).
  - Client error messages are generic; full detail is logged server-side.
- Quality (mirrors the `server` CI job, all **torch-free** —
  `pip install -r requirements-dev.txt` deliberately omits the ML stack):
  - `.venv/bin/ruff check app tests modal_app.py` + `ruff format --check`
  - `.venv/bin/pyright`
  - `.venv/bin/python -m pytest` (coverage floor 80 %, config in `pyproject.toml`)

  Covers the guards (CORS+Host+loopback+Origin), body caps, the stem store,
  WAV decoding, beat→bar numbering, chord spans, structure chunking and the
  Modal auth gate — all without torch. `separation.py` / `tempo.py` /
  `chords.py` / `structure.py` are the torch **humble objects**: excluded from
  pyright + coverage and exercised only through their absent-capability
  fallback; the real inference stays manual. To run those locally, also
  `pip install -r requirements.txt`.
