# Session — 2026-07-02 — jalon2-export-stems

## Done
- **Slice J2.6 — Export palier A** (closes the Jalon 2 backlog): the separated
  stems export as **one zip of aligned WAVs** ready for a DAW timeline.
  - **Core (outside-in)**: `exportStems` use-case — encode each stem as a
    numbered 16-bit WAV (`01_Voix.wav`…, `stemExportFilename`), zero-padded to
    the longest channel anywhere in the set (`padChannels`, pad-only — it
    throws rather than drop samples) so every file shares t=0 and one duration,
    then bundled through the new **`ArchiveWriter` port** (`write(files) →
    bytes`; the download stays in the adapter). Acceptance-tested against a
    fake archive; property tests on naming + padding. Registered in the
    application README (also refreshed the stale `ProjectStore` /
    `ProjectAudioStore` rows — HTTP adapters shipped at J3.3, not "fakes only").
  - **Web**: `createZipArchiveWriter` (fflate `zipSync`, entries **stored**
    uncompressed — WAV PCM barely deflates), « Exporter les stems (ZIP) » in
    the mixer panel, failures surfaced through the existing `AlertBanner`.
    Zip named `<base>_stems.zip` via `exportBaseName` (tag title, else file
    name sans extension, else `stems`).
  - The per-stem « WAV ↓ » download now reuses the core naming.
- **High-effort `/code-review` (8 angles), 5 confirmed bugs fixed** before PR:
  1. an export superseded by a `reset()`/new import no longer fires its
     download or plants its error banner into the new session (runId guard,
     same idiom as `separate`);
  2. the shared duration is the max over **every** channel (before: channel 0
     only — a longer second channel was silently truncated);
  3. `stemExportFilename` sanitises labels (`/` nested folders inside the
     zip; labels come from the server manifest, outside the core);
  4. single-stem downloads and the zip now share one numbering basis (position
     among the **present** stems — before, `03_Batterie.wav` alone vs
     `02_Batterie.wav` in the zip when a stem was masked);
  5. a blank ID3 title no longer yields `_stems.zip` (`''` is not nullish) and
     the track-name fallback strips the extension (`song.mp3_stems.zip`).
- Split multi-assertion tests in the new specs (one fact per `it`, per
  `tdd-cycle`); killed the `padChannels` equivalent mutants (TypedArray
  out-of-bounds writes made `Math.min`/`?? 0` unkillable → `Float64Array.set`).

## Not done / remaining
- **Browser click-through** of the export (button → zip lands, opens flat,
  files aligned in a DAW). Specs cover the seams; the real download was not
  hand-verified this session.
- **Deferred (documented, not silent)**, from the review:
  - the whole export runs one synchronous main-thread burst (encodeWav per
    stem + `zipSync` CRC/copy): ~1–3 s frozen UI on a 6-stem 4-min track.
    Follow-up: fflate's worker-backed async `zip` and/or encode off-thread.
  - peak memory ≈ 3× the export size (WAV files + archive + Blob copies all
    live at once). Follow-up: streaming `Zip` into Blob parts — needs a port
    reshape, deliberate refactor.
  - the French banner glues the core's English error strings (existing
    convention; typed error kinds in `Result` would fix it repo-wide).
  - tempo metadata in the export (plan §3.7) waits on real tempo detection.
- Rest of the UX backlog: uniform dirty-session guard on import/reload, tempo
  detection, tempo/pitch/zoom persistence, speed trainer, undo.

## Decisions
- **`ArchiveWriter` port returns bytes (`Uint8Array<ArrayBuffer>`), not a
  Blob** — the core stays browser-free; wrapping in a Blob and triggering the
  download is the adapter's business.
- **Zip entries are stored, not deflated** (level 0): 16-bit PCM barely
  deflates and store keeps the synchronous cost near a memcpy.
- **The export ships what the mixer shows**: present stems only, numbered in
  display order — and that basis is shared with the single-stem download.
- Numbering, naming and alignment live in the pure core (`stem-export.ts`);
  the caller picks *which* stems, the core owns *how they are written*.

## Gate status
- typecheck: ✅ (gate green end-to-end)
- tests (with coverage): ✅ 380 passed (48 files)
- mutation (Stryker, local): ✅ 95.68 % overall; `export-stems.ts` and
  `stem-export.ts` both **100 %**
- biome / sheriff / knip / jscpd / impeccable / react-doctor: ✅ (react-doctor
  required two rewrites: no `filter().map()` chain, and no await-then-early-
  return — the runId guard is now a positive `if` around the commit)

## State to resume from
- **Single next action**: open the PR for `feat/jalon2-export-stems` (3 commits:
  slice, mutation hardening, review fixes + this report), merge, then
  browser-verify the export on a real separation (see Not done) — after that
  Jalon 2 is fully closed and the UX backlog / Jalon 3 polish is next.
- Gotchas:
  - `padChannels` **throws** if `frames` is smaller than a channel (pad-only
    contract); `exportStems` computes `frames` as the max over all channels so
    it never trips it — a future caller must too.
  - react-doctor blocks `filter().map()` chains and awaits before an
    early-return guard in `packages/web` — shape hook code accordingly.
  - The `useSeparation` spec stubs `URL.createObjectURL`/`revokeObjectURL` and
    spies `HTMLAnchorElement.prototype.click` to observe downloads (jsdom
    implements none of them); reuse that pattern for future download tests.
