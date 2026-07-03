# STATUS

> Resumable source of truth. Updated at the end of each step via `/session-report`.

## Where we are

- **Phase**: **Jalon 2 (« Séparation IA ») — separation runs on a local server**
  (PR #19 merged). The in-browser WASM engines hit a quality/speed ceiling; a
  local **FastAPI + Demucs** backend implements the `StemSeparator` port behind an
  HTTP contract and is now the **only** engine — the WASM adapters were removed
  (branch `chore/remove-wasm-separators`). J2.2 merged (PR #17); parallel
  separation + WAV export merged (PR #18). Plan in
  [docs/jalon-2-plan.md](jalon-2-plan.md). Jalon 1 is **complete + polished**.
  See [docs/jalon-1-plan.md](jalon-1-plan.md).
- **Now — Jalon 2 is CLOSED (2026-07-02).** The last pending item — the J2.6
  export — was **browser-verified on a real separation** (The Cure – Lullaby,
  4:19, `htdemucs_6s`/MPS): zip flat, `01_Voix … 05_Autres` numbered aligned
  WAVs (11 456 000 frames each), present stems only, « Exporter » re-disabled
  on a new import (stale-export fix holds), console clean. Verification note:
  the export freezes the UI a few seconds (main-thread encode+zip of ~229 MB)
  — the deferred « off-thread zip/encode » item now has measured impact.
  Details in
  [2026-07-02-jalon2-export-verify](sessions/2026-07-02-jalon2-export-verify.md).
- **Jalon 3 (« Projets ») core slices are merged** (J3.1–J3.4 + races +
  active-loop fix + UX session state). Remaining Jalon 3 work is polish
  (project rename, blob GC, `separator-server/` → `server/`).
- **Now — tempo/pitch/zoom persistence slice (2026-07-03)**: the playback
  tuning (`timeRatio`/`pitchSemitones`/`zoom`) now round-trips through
  save/open and feeds the dirty fingerprint — the « real fix » the
  dirty-session-guard session flagged. Pure core `ProjectTuning` on
  `Project`/`SessionSnapshot` (optional, omitted when absent) +
  `tuningOrDefault` (the single « absent manifest = neutral (1,0,1) » seam,
  shared by the fingerprint and the restore path); `saveProject` threads it.
  Web: `sessionSignature` signs the tuning (old manifests sign as neutral →
  « Enregistré » right after open), `restoreSession` seats it via a new
  `restoreTuning` dep, the shell re-seats through the clamping player setters.
  Review found & fixed a real bug: importing a new file left the previous
  track's tempo/pitch (only zoom reset) — now `importFile` resets both, before
  `restoreTuning` on the open path. Gate green, **438 tests**, core mutation
  95.79 % (`project.ts` 100 %). **Browser-verify pending — on the Mac.** See
  [2026-07-03-persist-tempo-pitch-zoom](sessions/2026-07-03-persist-tempo-pitch-zoom.md).
- **Earlier — i18n slice (2026-07-03)**: all web UI copy goes through **Lingui**
  (canonical workflow: macros with explicit semantic ids, French source
  catalog `packages/web/src/locales/fr/messages.po`, compiled on import —
  no generated files in git), copy reworded to **infinitive forms**, and
  the specs now **test by key** (`i18n._('id', values)` +
  `I18nTestingProvider`, Lingui's official no-mock pattern) so copy changes
  never break tests. Same branch: `WorkstationShell` exploded into view
  regions (ShellHeader/ShellDialogs/ShellMain/ShellStage, shell = hooks +
  composition). Toolchain: plugin-react v6 silently dropped the babel
  option (macros leaked into the bundle) → pinned v5; vitest gets a
  dedicated babel macro pass; `i18n:extract` script wires
  `--overwrite --clean`. Gate green, 425 tests. **Stacked on the
  dirty-session-guard branch — PR to open after #36.** See
  [2026-07-03-i18n-lingui](sessions/2026-07-03-i18n-lingui.md).
- **Earlier — dirty-session guard slice (2026-07-03)**: the first UX-backlog
  item after the polish pass. One predicate — `unsavedWork` (saved project →
  signature drift; otherwise → a loaded track is itself unsaved work) — now
  guards the three destructive paths uniformly: « Importer » arms a two-step
  « Confirmer ? » (shared `useTwoStepConfirm`, also adopted by the projects
  dialog), `beforeunload` raises the native leave prompt, and the projects
  dialog only confirms an open when something would be lost (a clean saved
  session opens in one click — deliberate relaxation of the old `isLoaded`
  guard). High-effort review reshaped the predicate (a bare imported track
  was silently unguarded in the first cut). Gate green, 425 tests, mutation
  skipped (core untouched). **Browser-verify pending — on the Mac** (this
  WSL2 PC has no Chrome). See
  [2026-07-03-dirty-session-guard](sessions/2026-07-03-dirty-session-guard.md).
- **Earlier — UI polish slice (2026-07-03)**: user-driven polish pass before the
  next roadmap slice. **Draggable markers** (core `moveMarker`, TDD; drag +
  ←/→ nudge on the rail tags), **status indicators get one place per kind**
  (document-state chip next to the title absorbing the busy strip, server
  health far right, ✎ rename icon), and the **DAW-style track grouping**: a
  fixed gutter of per-stem headers (M/S, compact dB fader, WAV, confidence
  tooltip) row-aligned with the lanes via shared `--stem-lane-*` tokens — the
  detached mixer panel is deleted. Two user-found bugs fixed: arrow keys on a
  focused tag no longer double-fire the global seek (`defaultPrevented`
  guard), and the playhead can no longer paint above dialogs (stage
  `isolation`). Browser-verified on the real project.
  See [2026-07-03-ui-polish](sessions/2026-07-03-ui-polish.md).
- **Branch**: `feat/persist-tempo-pitch-zoom` (gate-green, 438 tests) — **PR to
  open**, browser-verify on the Mac before merge. Earlier: `feat/i18n-messages`
  **merged (PR #37)** and `feat/dirty-session-guard` **merged (PR #36)**;
  `feat/ui-polish` **merged (PR #35)**.
- **Earlier**: `feat/ux-session-state` (**merged, PR #34**) — five
  user-reported UX gaps: active-loop chip highlighted (`aria-current`), the
  header « Exporter » wired to the zip export (mixer duplicate removed), a
  status strip for save/open (the whole rebuild, not just the dialog), an
  « Enregistré / ● Non enregistré » read-out (`sessionSignature` fingerprint
  of loops/markers/loupe/mixer vs last save/open), and **incremental save**
  (client-side sha256 + session memo + `HEAD /audio/{ref}` — unchanged audio
  is never re-uploaded; new server HEAD route, fallback covers old servers).
  Browser-verified incl. the network trace; the running server already serves
  the HEAD route (probed 2026-07-02 — no restart needed).
- **Earlier**: `fix/project-keeps-active-loop` (merged, PR #33) — user-found
  bug fixed: the **armed A/B region (the loupe) was not part of the `Project`
  model** — saving a project silently dropped it (named loops persisted fine).
  Now persisted as optional `ProjectActiveLoop { region, enabled }` and
  re-armed on open, relinked to its saved loop when the region matches one.
  Root-caused against the real manifest, reproduced by shell tests written RED
  first, browser-verified end-to-end.
- **Earlier**: `feat/jalon2-export-stems` (gate-green, **PR #32 open**) —
  **Slice J2.6 (export palier A) is done**: `exportStems` use-case + pure
  `stem-export` domain (numbered, sanitised, zero-padded aligned WAVs) behind
  the new `ArchiveWriter` port; web fflate zip adapter (stored entries) +
  « Exporter les stems (ZIP) » in the mixer, present stems only, one numbering
  basis shared with the per-stem download. High-effort review fixed 5 confirmed
  bugs pre-PR (stale export after reset, every-channel duration, filename
  sanitisation, shared numbering, blank-title zip name). **Jalon 2 is
  code-complete** — browser click-through of the export pending. Deferred,
  documented: off-thread zip/encode, streaming archive (peak memory), typed
  error kinds, tempo metadata (needs tempo detection).
- **Earlier**: `feat/per-project-loops` (merged, PR #31) —
  the per-project loops slice is **done**: the localStorage `LoopStore` is
  gone (core port + use-cases deleted), loops are session state cleared by
  `startFreshTrack` and persisted only via the project manifest. Same branch:
  root-caused and fixed the flaky projects-dialog spec (Base UI defers the
  dialog's initial focus to an animation frame; in jsdom it stole focus from
  the armed « Confirmer ? » mid-test — specs now settle focus inside the popup,
  and each row action is one relabeled `RowAction` button), plus two review
  fixes: `restoreSession` aborts wholesale when its re-import was superseded,
  and removing the active saved loop marks the region unsaved again.
- **Earlier**: `fix/import-detaches-saved-project` (PR #30 merged) — the J3.3
  browser-verify caught a real data loss: importing a new file after opening a
  project kept `currentId`, so the one-click save silently overwrote the open
  project. Fixed (detach on import) with the three confirmed races around it
  (stale save re-attach, stale open clobbering a fresh import, superseded
  import winning late); the project ↔ session lifecycle lives in
  `useProjectSession`. All web specs migrated to `@testing-library/user-event`;
  testing idiom codified in `.claude/skills/react-testing-patterns`.
- **Earlier**: `feat/jalon3-project-server-ui` — Slice **J3.3** merged (PR #28). **Decision resolved: extended HTTP server** (not
  Tauri) — the one local server now hosts project storage (always on,
  content-addressed sha256 blobs + JSON manifests under `LOUPE_DATA_DIR`) and
  separation (lazily imported: a torch-less host still stores projects).
  Web: HTTP adapters on the J3.2 ports, « Enregistrer » (NameEditor) +
  « Projets » dialog in the header, full session save/rebuild (source bytes,
  loops, markers, stems re-encoded + replayed through the separation
  pipeline, mixer `restore` action). Browser click-through still pending.
  Earlier: **J3.2** (ports + use-cases, PR #27) and **J3.1** (pure `Project`
  domain, PR #25) merged.
  **Scope change (2026-06-30): J2.5 track grouping is dropped** (low value) —
  Jalon 2 now ends at the mixer (J2.4) + export (J2.6).
- **Packages**: `@app/core` (pure hexagon — `loadTrack`, `Waveform`/`Track`,
  `transportReducer`/`formatTimecode`, `clampPlaybackRate`/`clampPitchSemitones`,
  `clampZoom`/`zoomIn`/`zoomOut`, `resolveCommand`/`defaultKeyBindings`,
  `TrackMetadataReader` port, `separateTrack`/`StemSeparator` port +
  `separationReducer`/`StemSet`, `encodeWav`/`decodeWav` WAV codec,
  `mixerReducer`/`effectiveGains` + `StemPlaybackEngine` port +
  `combineWaveforms`) + `packages/web`
  (import → … → stem separation via the HTTP `createSeparator` → local FastAPI +
  Demucs backend; per-stem WAV download; gate-green). The starter `@app/cli`/`greet`
  example and the in-browser WASM separators have been removed.

## Locked decisions (kickoff)

- **Time-stretch engine**: **SoundTouch** (`@soundtouchjs/audio-worklet`, MPL-2.0)
  — **REVISED (2026-06-28)**. Rubber Band was confirmed at Slice 3 start, but its
  only web wrapper (`rubberband-web`) crashes on live pitch change and is
  unmaintained; in-browser verification surfaced it. SoundTouch fixes the crash
  **and** lifts the GPL obligation — the product can ship under any licence.
- **Separation engine** — **REVISED (2026-06-30): a local server is now the default
  and required path.** In-browser WASM (demucs.cpp GGML / onnxruntime-web) hit a
  quality+speed wall (quantised models, wasm32 memory ceiling, no native GPU). A
  **FastAPI + Demucs** backend (`separator-server/`, GPU-capable, outside the
  hexagon) implements the same `StemSeparator` port via an HTTP/NDJSON contract;
  `createSeparator` returns the HTTP adapter. **The in-browser WASM engines were
  removed** (branch `chore/remove-wasm-separators`) — server-side Demucs is the
  single supported engine. htdemucs weights are research-only — fine for this
  non-commercial tool, not for a commercial product.
- **Web stack**: React + Jotai · Base UI (headless) · Every Layout · CSS Modules +
  CSS-variable tokens · smart/dumb components.
- **Extra gates** (blocking, `packages/web` only): impeccable + react-doctor.
- **Per-slice loop**: `/new-feature-hexa` → `/tdd-cycle` → `pnpm gate` →
  `pnpm test:mutation` → **`/code-review`** → `/session-report` → PR.

## Next step

**Open the `feat/persist-tempo-pitch-zoom` PR and browser-verify it on the Mac
(slow/pitch/zoom → save → reload → reopen → same tuning + « Enregistré »), then
merge.** Then pick the next slice. Candidates, by user value:
- UX backlog: real tempo detection, speed trainer, undo.
- Jalon 3 polish: project rename, blob GC, `separator-server/` → `server/`.
- Perf: off-thread zip/encode — the export measurably freezes the UI a few
  seconds on a 4-min track (main-thread encode+zip, ~229 MB).

### Earlier — J3.3 browser-verify note

**Browser-verify J3.3, then merge its PR.** Run `pnpm dev` (the server side
needs only fastapi+uvicorn for storage — `separator-server/.venv` on this PC
has them), import a track, save (« Enregistrer »), reload, « Projets » →
open, and check markers/loops (and stems + mixer on a machine with Demucs).
Then pick the next slice: **J2.6 export** (aligned stem folder) or Jalon 3
polish (project rename, blob GC, `separator-server/` → `server/` rename).

### Earlier — Slice J3.2 (this branch, PR pending)

The application layer of project persistence: `ProjectStore` /
`ProjectAudioStore` ports + `saveProject` / `listProjects` / `openProject` /
`deleteProject`, acceptance-tested against fake in-memory adapters. Store-
minted refs; results as ok/error unions; parallel audio I/O; mixer↔stems
invariant enforced at its first consumer (`mixerMatchesStems`). Gate green,
291 tests, mutation 96.26% (application layer 100%). Known deferral: orphaned
blobs on failed/re-saves — mitigated by the content-addressing contract note,
reclamation is the adapter's business.

### Earlier — Slice J3.1 (merged, PR #25)
The pure `Project` domain that opens Jalon 3. `projectFromSession(session,
stamp)` is the single seam turning a `SessionSnapshot` into a saveable
`Project`: pure, with `id`/`name`/`now` **injected** (the core owns no clock/id
generator), `createdAt` = `updatedAt` = `now`. The model is deliberately
**light** — id/name/timestamps + `ProjectSource`, `LoopLibrary`, `MarkerList`,
optional `ProjectSeparation` (`ProjectStem[]` + `MixerState`); heavy audio
never enters it (source and each stem hold only an `AudioRef`). `separation` is
truly optional under `exactOptionalPropertyTypes` (key omitted, not
`undefined`). Core mutation 96.49% (`project.ts` 100%). The same session also
recovered the **lost design pass** (PR #24 — PR #23 had merged into the stale
J2.4 branch instead of `main`) and deleted all 13 merged remote branches.

### Earlier — Slice J2.4 (merged, PR #22)
The multitrack mixer: pure `MixerState` (`gainDb`/`muted`/`soloed` per stem →
`effectiveGains`, mute-wins, dB faders with a true-silence floor) +
`combineWaveforms` (audible-mix envelope), a `StemPlaybackEngine` port
implemented by a Web Audio gain graph (per-stem `GainNode` → one SoundTouch
master bus). Unified transport (stems drive the one transport once ready),
reactive audible-mix main waveform + per-stem aligned lanes. Core mutation
95.54%.

### Earlier — Slice J2.3 (merged, PR #21)
Adaptive instrument detection lives in the pure
core (`stemEnergy` + `detectInstruments`): every `StemTrack` now carries a
`confidence` and a `present` flag, the `SeparationPanel` masks near-silent stems
and shows the rest with a teal confidence badge (absent ones named on a « Non
détectés » line). The server default model moved to **`htdemucs_6s`** so guitar +
piano split out of "other" (overridable via `DEMUCS_MODEL`). Gate green, core
mutation 95.62% (new files 100%). **Next**: browser-verify a real 6-stem
separation, then **Slice J2.4** (multitrack mixer — solo/mute/volume over a Web
Audio gain graph). **J2.5 (track grouping) is dropped**; Jalon 2 closes with the
mixer (J2.4) then export (J2.6). See
[docs/jalon-2-plan.md](jalon-2-plan.md).

## Roadmap

| Step | Description | Status |
|------|-------------|--------|
| 0 | Starter bootstrapped (monorepo, toolchain, guardrails, example slice) | ✅ |
| J1.0 | Scaffold `packages/web` (Vite+React+TS, tokens, Every Layout, Base UI, extended gate) | ✅ |
| J1.1 | Import local file → waveform | ✅ |
| J1.2 | Transport: play/pause/seek + playhead + Space | ✅ |
| J1.3 | Time-stretch + pitch (SoundTouch worklet) — browser-verified | ✅ |
| J1.4 | Markers (section/measure/beat) | ✅ |
| J1.5 | A/B loop drag-select + named loops (the « loupe ») | ✅ |
| J1.6 | Zoom + scrollable viewport (6×) | ✅ |
| J1.7 | Keyboard shortcuts | ✅ |
| J2.1 | Import → separation → tracks screen (stub separator behind `StemSeparator` port) | ✅ |
| J2.2 | Real WASM separator adapters (demucs.cpp GGML default + onnxruntime-web), off-main-thread | ✅ |
| J2.2b | Server-side separation (FastAPI + Demucs) behind the `StemSeparator` port; HTTP/NDJSON, now the default engine | ✅ |
| J2.2c | Remove the superseded in-browser WASM separators (HTTP is the only engine) — −1598 lines | ✅ |
| J2.3 | Instrument detection → N adaptive tracks (mask empty, confidence) + server on `htdemucs_6s` (guitar/piano) | ✅ |
| J2.4 | Multitrack mixer (solo/mute/dB-volume, Web Audio gain graph, unified transport, reactive mix waveform + per-stem lanes) | ✅ |
| ~~J2.5~~ | ~~Track grouping (user bus, non-destructive)~~ — **dropped** (low value without enough perceived benefit) | 🚫 |
| J2.6 | Export — tier A: aligned stem folder (numbered sanitised WAVs, t=0, same duration, stored zip via `ArchiveWriter`/fflate) | ✅ |
| J3.1 | Pure `Project` domain — `projectFromSession` (light model, `AudioRef` pointers, injected id/name/now) | ✅ |
| J3.2 | Ports `ProjectStore` / `ProjectAudioStore` + use-cases `saveProject` / `listProjects` / `openProject` / `deleteProject` (fake adapters, mixer↔stems invariant enforced) | ✅ |
| J3.3 | Real adapter + UI (Save / list / Open) — **decided: extended HTTP server** (content-addressed blobs; storage works without torch) | ✅ |
| J3.4 | Per-project loops — localStorage `LoopStore` removed; loops are session state, persisted only via the manifest | ✅ |

## Session journal

Dated reports under [docs/sessions/](sessions/). Most recent on top.

- [2026-07-03 — persist-tempo-pitch-zoom](sessions/2026-07-03-persist-tempo-pitch-zoom.md) —
  UX-backlog slice: the playback tuning (tempo/pitch/zoom) round-trips through
  save/open and feeds the dirty fingerprint. Pure `ProjectTuning` +
  `tuningOrDefault` (one « absent manifest = neutral » seam shared by the
  fingerprint and restore); web signs the tuning, `restoreSession` seats it via
  a new `restoreTuning` dep, shell re-seats through the clamping setters.
  Review-found bug fixed: a new import left the previous track's tempo/pitch
  (only zoom reset) — `importFile` now resets both, before restore on the open
  path. Gate green, 438 tests, core mutation 95.79 % (`project.ts` 100 %).
  Browser-verify pending (Mac).
- [2026-07-03 — i18n-lingui](sessions/2026-07-03-i18n-lingui.md) —
  User-driven evolution: all web copy through Lingui (explicit ids, .po
  source of truth, infinitive French), specs test by key under the real
  i18n instance (official Lingui pattern, no mocking), WorkstationShell
  split into view regions. plugin-react v6 babel-option regression found
  (macro runtime shipped in the bundle) → pinned v5; vitest babel macro
  pass; extract --overwrite gotcha documented. Gate green, 425 tests,
  mutation skipped (core untouched). Browser-verify pending (Mac).

- [2026-07-03 — dirty-session-guard](sessions/2026-07-03-dirty-session-guard.md) —
  UX-backlog slice: uniform unsaved-work guard. `unsavedWork` predicate
  (project drift, or any loaded never-saved track) drives the armed
  « Confirmer ? » on « Importer », the `beforeunload` prompt
  (`useUnloadGuard`), and the projects-dialog open confirm (clean saved
  session = one-click open). Two-step confirm machine extracted to a shared
  `useTwoStepConfirm` (header + dialog). Review pass fixed the bare-track
  blind spot of the first fingerprint-based cut. Gate green, 425 tests,
  mutation skipped (core untouched). Browser-verify pending (Mac).
- [2026-07-03 — ui-polish](sessions/2026-07-03-ui-polish.md) —
  User-driven UI polish: draggable markers (core `moveMarker` TDD-first, drag +
  arrow-nudge on the rail tags), one place per kind of status in the header
  (document chip next to the title, server health far right, busy strip
  folded in), and DAW-style track grouping — fixed gutter of per-stem headers
  (M/S, compact fader, WAV) row-aligned with the lanes; the detached mixer
  panel deleted. Fixed two user-found bugs (arrow keys double-firing the
  global seek; playhead above dialogs). Gate green, 417 tests, mutation
  95.76 % (`marker-list.ts` 100 %). Browser-verified; PR to open.
- [2026-07-02 — jalon2-export-verify](sessions/2026-07-02-jalon2-export-verify.md) —
  Close-out: PR #34 merged, `HEAD /audio/{ref}` probed live (no restart
  needed), and the J2.6 export browser-verified on a real separation (zip
  flat, 5 numbered aligned WAVs, present stems only, stale-export reset
  holds, console clean). **Jalon 2 closes.** Found: the export freezes the
  UI a few seconds (main-thread encode+zip) — off-thread zip/encode now has
  measured impact. Gate green on `main`, 404 tests; mutation skipped (no
  code touched).
- [2026-07-02 — ux-session-state](sessions/2026-07-02-ux-session-state.md) —
  Five UX gaps in one slice: active-loop chip highlighted, header « Exporter »
  wired (mixer duplicate removed), save/open status strip, « Enregistré /
  Non enregistré » via a `sessionSignature` fingerprint, and incremental save
  (client sha256 + HEAD probe — unchanged audio never re-uploaded; verified by
  network trace). Core untouched (mutation skipped). Gate green, 404 tests.
- [2026-07-02 — project-active-loop](sessions/2026-07-02-project-active-loop.md) —
  User-found bug: reopening a project lost « la loop ». Root cause: the armed
  A/B region (the loupe) was **not in the `Project` model** — every layer
  saved faithfully, no test asserted the user-visible invariant. Fixed
  (optional `ProjectActiveLoop`, re-armed + relinked on open), reproduced RED
  first at shell level, browser-verified against the real server. Post-mortem
  in the report: round-trip tests must enumerate visible session state, and
  browser-verify the journey, not the endpoints. Gate green, 390 tests,
  mutation 95.83 %.
- [2026-07-02 — jalon2-export-stems](sessions/2026-07-02-jalon2-export-stems.md) —
  Slice J2.6 closes the Jalon 2 backlog: `exportStems` use-case (numbered,
  sanitised, zero-padded aligned WAVs — pad-only, never truncate) + the
  `ArchiveWriter` port; web fflate zip adapter (stored entries) + mixer button
  + `AlertBanner` on failure. High-effort review (8 angles) fixed 5 confirmed
  bugs pre-PR; deferred (documented): off-thread zip/encode, streaming
  archive, typed error kinds, tempo metadata. Gate green, 380 tests, mutation
  95.68 % (both new core files 100 %). PR to open; browser-verify pending.
- [2026-07-02 — per-project-loops](sessions/2026-07-02-per-project-loops.md) —
  Slice J3.4: loops become per-project — the localStorage `LoopStore` (core
  port + use-cases + web adapter) is deleted; `useLoops` is session state,
  cleared by `startFreshTrack`, persisted only via the project manifest.
  Root-caused the flaky projects-dialog spec (Base UI rAF-deferred initial
  focus disarming the two-step confirm in jsdom → settle focus inside the
  popup + single relabeled `RowAction` button; gotcha documented in the
  testing skill). Review fixes: `restoreSession` aborts when superseded;
  removing the active loop unsaves the region. Gate green, 347 tests,
  mutation 95.44 %. PR to open.
- [2026-07-02 — project-session-races](sessions/2026-07-02-project-session-races.md) —
  J3.3 browser-verify (FAIL → fix): import after open kept `currentId` and the
  one-click save overwrote the open project. Fixed with `detach()` on import,
  plus the three confirmed races found by the branch review (stale save
  re-attach, stale open clobber, superseded import) — session generation +
  import epoch + supersede guard; lifecycle extracted to `useProjectSession`.
  Web specs migrated to user-event; `react-testing-patterns` skill installed.
  **Decided: per-project loops** (localStorage store goes away) — next slice.
  Gate green, 348 tests; mutation skipped (core untouched). PR to open.
- [2026-07-02 — ux-feedback-guardrails](sessions/2026-07-02-ux-feedback-guardrails.md) —
  UX audit + the « feedback & garde-fous » slice (web-only): project errors
  surfaced (banner + « Serveur injoignable »), busy states on save/open,
  two-step delete + confirm-before-open, fake detected chips removed, server
  status dot (/health poll), one-click re-save, :focus-visible coverage.
  Gate green, 340 tests. Full prioritized backlog in the report (J2.6 next).

- [2026-07-02 — jalon3-server-adapter-ui](sessions/2026-07-02-jalon3-server-adapter-ui.md) —
  Slice J3.3: **backend decided — extended HTTP server**. Server split
  (`projects.py` storage always-on, `separation.py` torch-gated, lazy import;
  curl-verified without torch); content-addressed sha256 blobs, atomic writes.
  Web HTTP adapters + `useProjects`, « Enregistrer »/« Projets » in the header,
  full session save/rebuild (bytes retained, stems `encodeWav`↔`decodeWav`,
  separation replayed, new mixer `restore` action). Gate green, 316 tests,
  mutation 96.28%. Browser click-through pending.
- [2026-07-02 — jalon3-project-ports](sessions/2026-07-02-jalon3-project-ports.md) —
  Slice J3.2: the application layer of project persistence. `ProjectStore`
  (list/load/save/delete manifests) + `ProjectAudioStore` (`put` mints the
  `AudioRef`, `get` resolves; adapters should content-address) pulled into
  existence by `saveProject` / `listProjects` / `openProject` / `deleteProject`
  over fake in-memory adapters. Mixer↔stems invariant enforced fail-fast at its
  first consumer (pure `mixerMatchesStems`); re-save keeps `createdAt`. Review
  fixes: parallel audio I/O, shared `errorMessage`, port contract notes. Gate
  green, 291 tests, mutation 96.26% (application 100%). Next: J3.3 (real
  adapter + UI — Tauri vs server decision).
- [2026-07-02 — jalon3-merge-and-branch-cleanup](sessions/2026-07-02-jalon3-merge-and-branch-cleanup.md) —
  Post-merge close: **PR #25 (J3.1 Project domain) merged**; **PR #24 recovered
  the lost design pass** (PR #23 had been merged into the stale
  `feat/jalon2-multitrack-mixer` branch instead of `main` — wrong base branch,
  zero conflicts on recovery). All 13 merged remote branches deleted (+ local);
  only `main` remains. Recommendation: enable GitHub "Automatically delete head
  branches". Gate green on `main` (274 tests); mutation skipped (no code touched
  since the pre-PR run). **Next**: J3.2.
- [2026-07-01 — jalon3-project-domain](sessions/2026-07-01-jalon3-project-domain.md) —
  Slice J3.1 opens **Jalon 3 (project persistence)**. Pure core
  `projectFromSession(session, stamp)` assembles a light `Project`
  (source/loops/markers + optional `ProjectSeparation` = stems + `MixerState`)
  from a `SessionSnapshot` and an injected `ProjectStamp` (`id`/`name`/`now` —
  the core owns no clock/id generator; `createdAt` = `updatedAt` = `now`). Heavy
  audio never enters the model — source and each stem hold only an `AudioRef`,
  resolved later by a `ProjectAudioStore` adapter. `separation` truly optional
  under `exactOptionalPropertyTypes`. **Decision: domain-first** — Tauri-vs-server
  is a late adapter choice (J3.3). Gate green, core mutation 96.49%
  (`project.ts` 100%). PR open.
- [2026-07-01 — jalon2-multitrack-mixer](sessions/2026-07-01-jalon2-multitrack-mixer.md) —
  Slice J2.4: the multitrack mixer. Pure core `mixerReducer`/`effectiveGains`
  (per-stem `gainDb`/`muted`/`soloed` → one linear gain; mute-wins; dB faders with
  a true-silence floor) + `combineWaveforms` (audible-mix envelope). New
  `StemPlaybackEngine` port → Web Audio gain graph (per-stem `GainNode` → one
  SoundTouch master bus). **Unified transport**: stems drive the single transport
  once ready (one playhead/loop, tempo/pitch on the mix). The **main waveform
  shows the reactive audible mix**; each stem gets an **aligned, read-only lane**
  inside the zoom stage that pales with its level. Mixer panel = dB fader +
  mute/solo + confidence + WAV per stem; the « Séparer » action hides once ready.
  Engine load + mixer seed are event-driven (no prop-watching effect). Gate green,
  core mutation 95.54%. Browser-verify pending.
- [2026-06-30 — jalon2-instrument-detection](sessions/2026-06-30-jalon2-instrument-detection.md) —
  Slice J2.3: adaptive instrument detection. Pure core `stemEnergy` (RMS) +
  `detectInstruments` (energy relative to the loudest → `confidence` ∈ [0,1] +
  `present` above `PRESENCE_THRESHOLD`); `StemTrack` carries the verdict and
  `separateTrack` runs it. `SeparationPanel` masks near-silent stems, shows kept
  ones with a teal confidence badge, and names the masked ones on a « Non
  détectés » line. Server default model switched to `htdemucs_6s` so guitar +
  piano split out of "other" (the whole point of masking); `DEMUCS_MODEL` still
  overrides. Gate green, core mutation 95.62% (new files 100%). Real 6-stem
  browser-verify pending.
- [2026-06-30 — remove-wasm-separators](sessions/2026-06-30-remove-wasm-separators.md) —
  Removed the superseded in-browser WASM separators now that the HTTP separator
  (PR #19) is the only engine: GGML/ONNX adapters, workers, parallel/worker
  orchestrators, model-cache, resample, stem-layout, audio-format; vendored
  `public/demucs`/`public/ort` + build scripts; the `onnxruntime-web` dep;
  `create-separator` collapsed to a no-arg HTTP factory; and the now-dead core DSP
  (`segment-plan`, `overlap-add`) + their exports. Net −1598 lines across 25 files.
  Gate green, core mutation 95.37%. Next: Slice J2.3 / in-app per-stem playback.
- [2026-06-30 — jalon2-server-side-separation](sessions/2026-06-30-jalon2-server-side-separation.md) —
  Separation pivoted off the browser onto a local **FastAPI + Demucs** server,
  behind the same `StemSeparator` port. New pure core `decodeWav` (mutation
  96.67%), web `createHttpSeparator` adapter (mix → WAV POST → streamed NDJSON
  progress → fetch + decode stems), now the default `'http'` engine. Server runs
  `htdemucs` on the Apple GPU (MPS), re-orders stems to the UI layout, and streams
  genuine per-segment progress by intercepting Demucs' internal tqdm. Two real bugs
  found by testing (no `apply_model` callback; torchaudio 2.11 dropped its WAV
  backend). Browser-verified (~4-min track in ~38 s). Gate green, core mutation
  95.66%. Backend deliberately outside the hexagon. Follow-up: remove the
  superseded WASM engines in a separate PR.
- [2026-06-29 — jalon2-parallel-and-wav](sessions/2026-06-29-jalon2-parallel-and-wav.md) —
  Two separation enhancements behind the same `StemSeparator` port: **data-parallel
  GGML** (core `overlapAdd` + `planChunks`; N=`min(cores−1,4)` workers blend
  overlapping chunks) and **per-stem WAV export** (core `encodeWav` + retained PCM +
  « WAV ↓ » button) so stems can be heard. Browser-verified. High-effort review:
  no happy-path bug; fixed chunk-overlap cap, per-chunk windows, post-supersede
  rejection, progress phase, early `revokeObjectURL`. Gate green, core mutation
  94.24%. Orchestrator single/parallel consolidation noted as follow-up; in-app
  playback is the next slice.
- [2026-06-29 — jalon2-wasm-separator](sessions/2026-06-29-jalon2-wasm-separator.md) —
  Slice J2.2: real client-side separation behind the `StemSeparator` port. Core
  `segment-plan` (planSegments + transitionWindow, overlap-add DSP, mutation 95.95%).
  Two selectable WASM engines (`createSeparator`): default **GGML** (`demucs.cpp`
  compiled via Docker/emsdk, fp16 ~84 MB, committed under `public/demucs/`) and
  **ONNX** (htdemucs via onnxruntime-web, ~166 MB). Module workers, resample to
  44.1 kHz, Cache-API model download. Browser-verified. WebGPU ruled out (ORT can't
  run the embedded iSTFT on GPU); fp16-vs-OOM and several Vite /public-import gotchas
  documented. Speed limit (CPU single-thread) → multi-worker parallelism deferred.
  Gate green, core mutation 95.98%.
- [2026-06-28 — jalon2-separation-screen](sessions/2026-06-28-jalon2-separation-screen.md) —
  Slice J2.1 (opens Jalon 2): separate the loaded track into stems, UI-first behind
  a pure `StemSeparator` port. Core: `separateTrack` use-case + `SeparationState`
  reducer + `StemSet`/`StemTrack` (`buildStemTrack` reuses the track mono-mix →
  waveform). `loadTrack` now returns the decoded PCM so separation reuses the SAME
  input (no second import). Web: `createStubSeparator`, `useSeparation` (run-id
  guard against a stale run), `SeparationPanel`. Gate green; core mutation 95.99%
  (`separate-track`/`stem-set` 100%). High-effort review: 1 real bug fixed (stale
  separation landing on a new track).
- [2026-06-28 — jalon1-polish-loops-markers](sessions/2026-06-28-jalon1-polish-loops-markers.md) —
  Hands-on polish of Jalon 1: wired transport ⏮/⏭ (⟳ removed); live loop
  selection + draggable A/B handles that update saved loops in place; `NameEditor`
  popover replacing `window.prompt` (loops + marker rename); loop enable/disable
  toggle; no duplicate-save for saved regions; markers simplified to one named
  « Repère » (dropped `MarkerKind` from core); zoom scrollbar gutter reserved to
  stop layout shift. Gate green, core mutation 96.25% (key-bindings & marker-list
  100%).
- [2026-06-28 — jalon1-shortcuts-help-and-layout-fix](sessions/2026-06-28-jalon1-shortcuts-help-and-layout-fix.md) —
  Slice 7 follow-up (same branch / PR #13): in-app shortcuts help (pure
  `describeKeyBindings` deriving French rows from the active bindings + Base UI
  `ShortcutsDialog` behind a header "?"). Two in-browser fixes: shortcuts were
  swallowed while a control button held focus (guard now blocks only text entry),
  and layout-wrong keys (`+`/`−` dead, `,` instead of `m`) — `KeyChord` now matches
  mnemonic keys by typed character, spatial keys by physical code. `key-bindings.ts`
  100% mutation. Gate green.
- [2026-06-28 — jalon1-keyboard-shortcuts](sessions/2026-06-28-jalon1-keyboard-shortcuts.md) —
  Slice 7 (closes Jalon 1): pure `KeyBindings` domain (`resolveCommand` /
  `defaultKeyBindings`, exact code+modifier match, 100% mutation) +
  `useKeyboardShortcuts` web adapter folding in the old Space listener (ref-fresh
  actions, `enabled`-gated). Space/←→/=−/M bound; bare keys never hijack browser
  chords. Gate green.
- [2026-06-28 — jalon1-zoom-review](sessions/2026-06-28-jalon1-zoom-review.md) —
  Slice 6 follow-up: prototype-aligned zoom (magnify slider + native scroll +
  shared `ZoomStage`), `Viewport` reduced to a zoom scalar, file-metadata header
  (`TrackMetadataReader` + music-metadata), inspector marker list, high-effort
  code review fixed (metadata race, marker removal, auto-follow). Merged via
  PR #11 (first cut) + PR #12 (corrections).
- [2026-06-28 — jalon1-zoom-viewport](sessions/2026-06-28-jalon1-zoom-viewport.md) —
  Slice 6: pure `Viewport` (normalised ratio space, round-trip property-tested,
  mutation 95.35%) + `sliceWaveform`, `useViewport` + `ViewportControls`,
  viewport-aware `WaveformView` (slice peaks, zoom-at-centre, wheel pan, memoised
  canvas). 4 code-review fixes folded in (empty-slice bug, wheel intent, anchor,
  memo).
- [2026-06-28 — session-wrap](sessions/2026-06-28-session-wrap.md) — Jalon 1
  Slices 1→5 shipped & merged (PRs #6–#10); engine switched to SoundTouch (MPL);
  tooling findings (gate enforcement is CI+manual not pre-commit; impeccable scope).
- [2026-06-28 — jalon1-loops](sessions/2026-06-28-jalon1-loops.md) —
  Slice 5: `LoopRegion`/`LoopLibrary` + `LoopStore` port + loops use-cases (core,
  loops.ts 100% mutation), localStorage adapter, drag-select + loupe dim overlay +
  loop playback + saved-loops bar.
- [2026-06-28 — jalon1-markers](sessions/2026-06-28-jalon1-markers.md) —
  Slice 4: `Marker`/`MarkerList` (core, marker-list 100% mutation), `useMarkers`,
  `MarkerControls` + `MarkerRail` (add at playhead, click-seek, remove, amber by kind).
- [2026-06-28 — jalon1-timestretch](sessions/2026-06-28-jalon1-timestretch.md) —
  Slice 3: `clampPlaybackRate`/`clampPitchSemitones` (core, mutation 94.41%),
  `PlaybackEngine` gains tempo/pitch, Rubber Band worklet adapter + wired sliders.
  GPL confirmed. ⚠️ audio path browser-verify pending.
- [2026-06-28 — jalon1-transport](sessions/2026-06-28-jalon1-transport.md) —
  Slice 2: `transportReducer` + `formatTimecode` (core, mutation 96%), `PlaybackEngine`
  port + `WebAudioPlayback` adapter, play/pause/seek, playhead, click-to-seek, Space.
- [2026-06-28 — jalon1-import-waveform](sessions/2026-06-28-jalon1-import-waveform.md) —
  Slice 1: `loadTrack` + `Waveform`/`Track` (core, mutation 96.70%), `WebAudioDecoder`
  adapter, single header-driven import, amber `WaveformCanvas`. Gate green.
- [2026-06-28 — jalon1-web-scaffold](sessions/2026-06-28-jalon1-web-scaffold.md) —
  Slice 0: `packages/web` scaffolded (Vite+React+Base UI+Every Layout+CSS Modules),
  gate extended (impeccable + react-doctor), kickoff decisions locked.
