# Session — 2026-07-04 — import-from-url (core slice)

## Done
- **Feasibility settled** for "import a track from a URL" (YouTube / SoundCloud).
  Rejected **play-dl** (Node lib, wrong runtime for our **Python** server, largely
  unmaintained, breaks on YouTube changes) in favour of **yt-dlp** (Python-native,
  actively maintained), which drops straight beside Demucs/librosa in
  `separator-server`. Spotify/Deezer **dropped** (DRM'd streams; only a
  metadata → YouTube-search detour, which we chose not to take).
- **Core slice (outside-in, TDD strict) — merged into the layer, gate-green:**
  - Port **`TrackSource`** + `FetchedTrack` / `DownloadProgress` (phases
    `downloading` → `transcoding`) / `TrackSourceMetadata` in
    [ports.ts](../../packages/core/src/application/ports.ts). "URL in → encoded
    audio bytes + metadata out, progress streamed"; hides the transport (NDJSON,
    content-addressed store, ref) entirely from the core.
  - Use-case **`importFromUrl`**
    ([import-from-url.ts](../../packages/core/src/application/import-from-url.ts)):
    validates the URL, calls the port, returns `{bytes, metadata}` for `loadTrack`
    to decode, maps throws to a `Result`.
  - Application policy **`isSupportedSourceUrl`**
    ([supported-source.ts](../../packages/core/src/application/supported-source.ts)):
    accepts only YouTube/SoundCloud hosts (+ subdomains), rejects malformed /
    non-http(s) / look-alike hosts (`youtube.com.evil.example`).
  - Exported the public surface from
    [index.ts](../../packages/core/src/index.ts); registered use-case + port in
    [application/README.md](../../packages/core/src/application/README.md) as **J4.1**.

## Not done / remaining
- **Web adapter** `createHttpTrackSource` (`packages/web/src/audio/…`): speak the
  NDJSON contract — `POST /download {url}` → stream progress → on `done` `GET
  /audio/{ref}` for the bytes. Mirror `createHttpSeparator`.
- **Server** `separator-server/app/download.py`: lazy-import group (like
  `separation`/`tempo`) — yt-dlp → m4a/AAC → park bytes in the content-addressed
  `/audio` store → NDJSON progress + `done{ref, contentType, title, duration,
  uploader}`. Includes the **auto-retry + nightly `pip install -U yt-dlp` on an
  extraction failure** strategy (impure, server-only — never in the core).
- **UI slice**: URL field + progress bar + name pre-fill from metadata. ⚠️ Per
  CLAUDE.md, **confirm the approach/mockup before coding this** — not started.

## Decisions
- **yt-dlp, not play-dl** (runtime fit + maintenance). Update strategy:
  auto-retry-with-nightly-upgrade on extraction failure, server-side only.
- **Response contract**: NDJSON streamed (mirrors `/separate`), audio parked in
  the existing content-addressed `/audio` store → `done` returns a `ref` +
  metadata; the web adapter `GET`s the bytes. Chosen over inline-audio (base64
  bloat) and a transient job-dir (a source track wants the persistent store).
- **Audio format m4a/AAC** — max browser `decodeAudioData` compat without the
  ~10× store bloat of WAV.
- **Supported-hosts rule lives in `application`, not `domain`** — it is policy
  about our adapters (which services we integrate), not an audio-domain invariant.
  Clean-vs-hexagonal distinction applied deliberately.
- **Scope**: direct YouTube / SoundCloud URLs; server stays localhost,
  single-user (defuses the ToS concern — private use, no redistribution).

## Gate status
- typecheck: ✅ (via `pnpm gate`, EXIT=0)
- tests (with coverage): ✅ **512 tests** green
- mutation (Stryker, local — core touched): ✅ **94.52 %** overall; the two new
  files **`import-from-url.ts` 100 %** and **`supported-source.ts` 100 %** (3
  survivors found and killed pre-PR: an emptied error string + the untested
  `http://` protocol branch).
- biome / sheriff / knip / jscpd: ✅ (EXIT=0; 14 jscpd clones pre-existing, under
  threshold; the new files add none).

## State to resume from
- **Single next action**: build the **web adapter** `createHttpTrackSource`
  against the fixed NDJSON contract (mirror `createHttpSeparator` in
  `packages/web/src/audio/`), then `download.py`. The UI comes last and needs an
  approach/mockup check first.
- Gotchas / half-done edits:
  - On branch **`feat/import-from-url`** (created off `main`; the pre-existing
    `M CLAUDE.md` in the tree is unrelated and left untouched).
  - `isSupportedSourceUrl` is intentionally **not** exported from `index.ts` (no
    consumer yet — the UI will pull it if it wants to disable the button). The
    use-case is the only gate for now.
  - Server `download.py` must park bytes via the SAME content-addressed scheme as
    `POST /audio` (sha256) so `GET /audio/{ref}` resolves them — reuse
    `projects.py`'s store, don't fork a second one.
