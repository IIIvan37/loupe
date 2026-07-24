# Session — 2026-07-04 — import-from-url (web adapter + server + UI)

Continues [2026-07-04-import-from-url-core](2026-07-04-import-from-url-core.md)
(the core slice). This session lands the three remaining pieces — the web
adapter, the server, and the UI — so **J4.1 is now a full vertical slice**.

## Done
- **Web adapter `createHttpTrackSource`**
  ([http-track-source.ts](../../packages/web/src/audio/http-track-source.ts)):
  speaks the fixed NDJSON contract — `POST /download {url}` → stream progress →
  on `done{ref,title,duration?,uploader?}` `GET /audio/{ref}` for the bytes →
  maps onto `FetchedTrack` (title/durationSeconds/artist). Factory
  [create-track-source.ts](../../packages/web/src/audio/create-track-source.ts)
  (points at `SERVER_URL`, mirrors `createSeparator`).
- **Shared NDJSON reader**
  ([read-ndjson.ts](../../packages/web/src/audio/read-ndjson.ts)): the streaming
  line reader plus a generic **`streamNdjson`** (forward `progress` → `onProgress`,
  throw on `error`, return the terminal `done`). Both HTTP adapters (separation +
  download) now share it — the duplicated stream-consumption loop **and** the
  NDJSON reader are gone (`http-separator` refactored onto it).
- **Server `download.py`**
  ([download.py](../../separator-server/app/download.py)): yt-dlp on a worker
  thread, progress bridged to an NDJSON stream via a queue (mirrors
  `/separate`). Asks for `bestaudio[ext=m4a]` so the common case needs **no
  ffmpeg** (m4a/AAC decodes straight in the browser). Host allowlist mirrors the
  core's `isSupportedSourceUrl` (yt-dlp is a powerful fetcher — never an open
  proxy). **Auto-retry + `pip install -U yt-dlp`** on an extraction failure
  (impure, server-only). Parks bytes via the shared, newly-extracted
  `projects.store_audio()` (same content-addressed `/audio` store — no forked
  store). Lazy-imported in [main.py](../../separator-server/app/main.py) with an
  NDJSON-error fallback when yt-dlp is absent (verified: the app still builds and
  serves the fallback `/download`). `yt-dlp>=2024.1` added to
  [requirements.txt](../../separator-server/requirements.txt).
- **UI — « Menu sur Importer » (approach confirmed with the user first):**
  - Hook **`useImportFromUrl`**
    ([use-import-from-url.ts](../../packages/web/src/app/header/use-import-from-url.ts)):
    drives `importFromUrl` through the adapter, streams progress into state, hands
    `{bytes, metadata}` to `session.importDownloaded`. Run-id guard against a
    superseded run; `source` injectable for tests.
  - **`ImportMenu`**
    ([import-menu.tsx](../../packages/web/src/app/header/import-menu.tsx)): the
    « Importer » trigger opens a menu (« Fichier… » / « Depuis une URL… »); the URL
    item opens a popover with the link field. The unsaved-work guard sits on
    **opening the menu** — one « Confirmer ? » covers whichever path is then
    picked. Built on Base UI **Popover** (not Menu — Menu's `onOpenChange` doesn't
    fire reliably on click in jsdom; Popover, which the specs already drive, does).
  - `session.importDownloaded(bytes, metadata)`
    ([use-project-session.ts](../../packages/web/src/app/workstation-shell/use-project-session.ts)):
    same detach-and-refresh prelude as a picked file (extracted `beginImport`),
    wraps the fetched bytes in a `File` and reuses the exact decode path; title
    seeded from the metadata.
  - Wiring: `WorkstationShell` instantiates the hook (new `trackSource` test prop)
    and passes `urlImport` to `ShellHeader`, which narrates download progress in
    the **state chip** (`Téléchargement… N %` / `Extraction de l'audio…`) and
    surfaces errors via the existing **AlertBanner**. Copy through Lingui (fr
    catalog extracted).
  - **CSS dedup**: the popover-form skin (popup/title/input/actions/ghost/submit)
    extracted to
    [popover-form.module.css](../../packages/web/src/app/ui/popover-form.module.css)
    and `composes:`d by both `name-editor` and `import-menu` — the CSS clones the
    first cut introduced are gone.
  - **Source metadata → header artist**: `importFile` gained an optional
    `fallbackMetadata`; `importDownloaded` passes the URL's title + artist
    (yt-dlp's `uploader`). Embedded tags still win; the fallback fills what a bare
    m4a omits. Browser-verified: « Me at the zoo » now shows artist « jawed ».

## Not done / remaining
- **PR not yet opened** for the branch (`feat/import-from-url`).

## Decisions
- **UI entry point: a menu on « Importer »** (« Fichier… » / « Depuis une URL… »),
  chosen with the user over a second button or a dedicated dialog.
- **Guard placement**: the unsaved-work two-step confirm gates **opening the
  menu**, so one confirmation covers both import paths.
- **Base UI Popover, not Menu**, for the dropdown — Menu's open-on-click doesn't
  drive under jsdom; Popover (already used by `NameEditor`) does.
- **Download progress → the header state chip; errors → AlertBanner** (reuse the
  save/open infrastructure) rather than an in-popover progress bar — the popover
  closes on submit, no fragile completion-sync effect.
- **`streamNdjson` is the shared seam** for the progress-stream contract; the
  per-adapter "ended without a result" message is now the generic "stream ended
  without a result".

## Gate status
- typecheck: ✅ (`pnpm gate`, EXIT=0)
- tests (with coverage): ✅ **527 tests** green (+15 this session: 8
  `http-track-source`, 4 `use-import-from-url`, 3 shell URL-import; 2 existing
  shell import-flow tests reworked for the menu)
- mutation (Stryker, local): **skipped — core untouched this session** (the core
  slice already scored `import-from-url.ts` / `supported-source.ts` at 100 %).
- biome / sheriff / knip / jscpd: ✅ (EXIT=0; **15 jscpd clones**, under the 2.5 %
  threshold — down from 19 mid-session after the CSS + NDJSON dedup; the new files
  add no logic clone). react-doctor + impeccable ✅.
- Server: `py_compile` clean; app builds with yt-dlp absent and serves the
  fallback `/download` (checked via the venv python).
- **Browser-verified end-to-end** (2026-07-04, Mac, `yt-dlp 2026.06.09` installed
  in the venv): « Importer → Depuis une URL… », pasted
  `youtube.com/watch?v=jNQXAC9IVRw`, watched « Téléchargement… N % » in the state
  chip, and the track loaded — title « Me at the zoo », **artist « jawed »** (the
  uploader, via the fallback), duration 0:19, waveform + metronome lanes, tempo
  auto-detected **117 BPM**. Network trace all 200
  (`POST /download` NDJSON, `GET /audio/{ref}`, `POST /tempo`); console clean bar
  an unrelated favicon 404. The parked blob is a valid ISO-Media m4a (curl).

## State to resume from
- **Single next action**: the PR is being opened for `feat/import-from-url`
  (browser-verify done, artist surfaced). Nothing else pending in the slice.
- Gotchas / half-done edits:
  - **yt-dlp is now installed in `separator-server/.venv`** (2026.06.09); it is
    NOT in a lockfile — only `requirements.txt` records it. A fresh env needs
    `pip install -r requirements.txt`.
  - A FastAPI server was started on `127.0.0.1:8000` for the verify (full stack,
    MPS) — kill it if it lingers.
  - On branch **`feat/import-from-url`**; the pre-existing `M CLAUDE.md` in the
    tree is unrelated and left untouched. No commits made this session yet.
  - `readNdjson` is intentionally **not exported** (module-internal); only
    `streamNdjson` is — react-doctor flags an unused export otherwise.
  - The URL popover is anchored to the import trigger via a `ref` (`anchor`
    prop) since it's a second Popover sharing the one trigger button.
  - `download.py`'s runtime `pip install -U yt-dlp` + `importlib.reload` is
    best-effort self-heal; a stubborn extractor break resolves on the next
    process start.
