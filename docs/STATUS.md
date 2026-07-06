# STATUS

> Resumable source of truth. Updated at the end of each step via `/session-report`.

## Where we are

- **Now — Tempo Lot B part 2 done, Lot B COMPLETE (2026-07-06)** on branch
  `feat/tempo-beat-this-server` (off `main`, part 1 merged as PR #67). The **server
  DSP swap**: `/tempo` now runs CPJKU's **`beat_this`** transformer (beats **and**
  downbeats, MIT, robust to tempo/metre changes) instead of librosa's beat tracker,
  so the `barPosition` machinery shipped in pt.1 detects the **real** metre instead
  of counting 4/4 from beat 0. New **torch-free humble object**
  [beat_positions.py](../server/app/beat_positions.py) maps beat_this's two arrays
  `(beats, downbeats) → [{time, position}]` (nearest-match downbeats, bar numbering,
  pickup back-count) + a **median-interval** representative bpm — unit-tested
  **100 %**, pyright-clean. [tempo.py](../server/app/tempo.py) is now the thin torch
  shell (decode → `Audio2Beats` → pure mapper; model built once/lazily, device
  auto-picked CUDA/MPS/CPU), behind the same lazy-import **503 fallback** (now
  torch/beat_this). requirements **+beat-this==1.1.0 −librosa**. Server pytest
  **91 passed, 97 %**; JS gate **green — 624 tests** (web untouched); mutation
  **skipped** (server-only Python). **Real-audio verified on the Mac (MPS)**: The
  Cure – Lullaby → **93.75 BPM**, clean **4/4** (inter-downbeat gaps all 4 beats).
  **This closes Lot B. Next: open the PR, then Lot C** (tempo-map — variable tempo,
  `ProjectTempo.segments`, BPM read-out at the playhead). See
  [2026-07-06-tempo-beat-this-server](sessions/2026-07-06-tempo-beat-this-server.md).
- **Prior — Tempo Lot B part 1 done (2026-07-06, merged PR #67)** on branch
  `feat/tempo-enriched-contract` (off `main`, Lot A merged as PR #66). The pure,
  testable half of the linchpin: the **enriched `/tempo` contract** carried
  end-to-end. Beats now carry a **`barPosition`** (1 = downbeat) instead of bare
  seconds — new domain `DetectedBeat`; `buildBeatGrid` flags downbeats from the
  position (robust to pickup/missing beats, no counting from beat 0); new pure
  **`detectMeter`** = max bar position. `TempoAnalysis`/`ProjectTempo` gain
  **`beatsPerBar`** (absent ⇔ 4/4 on old manifests; **not** signed — derived, not
  user-editable). `foldTempoOctave` adapted to **preserve downbeat phase**
  (carries flags from retained beats, drops the `beatsPerBar` param). The web
  adapter maps `{beats:[{time,position}]}` and **tolerates the current librosa
  server** (bare seconds → counted positions) so the branch ships before the
  server PR. New **meter read-out** (« N temps ») in the tempo panel. Gate
  **green — 624 tests**; mutation overall **94.92 %**, changed core files
  (`tempo.ts`/`detect-tempo.ts`/`project.ts`) **100 %**. **Deferred to the next PR
  (user-confirmed 2-PR split): the server `beat_this` DSP swap** (heavy install +
  weights, real-audio verify). **Next: open the PR, then the Lot B server half.**
  See [2026-07-06-tempo-enriched-contract](sessions/2026-07-06-tempo-enriched-contract.md).
- **Prior — Tempo Lot A done (2026-07-06)** on branch `feat/tempo-octave-toggle`
  (off `main`). First lot of the **tempo-detection upgrade** (plan:
  [tempo-detection-plan.md](tempo-detection-plan.md)): a manual **×2 / ÷2 octave
  correction** for the common octave error (detection locking to the eighth note).
  Pure core transform **`foldTempoOctave`** ([tempo.ts](../packages/core/src/domain/tempo.ts))
  folds beat density + rescales bpm; the tempo hook tracks a **±2 octave shift**,
  re-seats the click via a new mixer **`replaceStem`** primitive
  ([use-mixer.ts](../packages/web/src/app/mixer/use-mixer.ts)) +
  metronome **`reseat`**, and persists the fold as **`ProjectTempo.octaveShift`**
  (first user-editable tempo state → added to `sessionSignature`, absent ⇔ 0).
  ÷2/×2 buttons in [tempo-panel.tsx](../packages/web/src/app/tempo/tempo-panel.tsx).
  Gate **green — 617 tests**; mutation **94.89 %** overall, new `tempo.ts`
  **100 %** (31 mutants). **Next: open the PR, then Lot B** — enrich the `/tempo`
  contract with per-beat `barPosition` + swap the server DSP to `beat_this`
  (downbeats/meter + variable tempo). See
  [2026-07-06-tempo-octave-toggle](sessions/2026-07-06-tempo-octave-toggle.md).
- **Prior — Lot E complete (2026-07-06)** on branch `refactor/web-split-use-player`
  (off `main`, trio merged as PR #64): **E.1 — split `use-player.ts`**, the last
  item of Lot E. The hook (366 lines, 6 anti-stale refs, 5 responsibilities) is
  now three: **[use-loop.ts](../packages/web/src/app/waveform/use-loop.ts)** owns
  the A/B loupe state (armed region, wrap flag, re-arm heuristic, persisted
  restore); **[use-transport-engines.ts](../packages/web/src/app/waveform/use-transport-engines.ts)**
  owns the two engines under one transport (reducer, `active()` selector, loop
  wrap-around, single↔stem hand-off + its four transport refs);
  **[use-player.ts](../packages/web/src/app/waveform/use-player.ts)** keeps just
  the import flow + tempo/pitch controls and wires them (**269 lines, 1 ref**).
  Public `Player` surface unchanged (behaviour-preserving); each extracted hook
  has a colocated renderHook spec (fake engines drive the position stream to prove
  wrap + hand-off directly). Gate **green — 595 tests** (+8), coverage
  95.77 %/88.81 %, jscpd 5 clones (unchanged); mutation **skipped** (web-only).
  **This closes Lot E** — with Lots A–D done (D.1 deferred to veille), the
  durcissement & excellence roadmap is complete. **Next: a new direction** (see
  § Next step — Jalon 4 MIDI, off-thread zip/encode perf, or a UX item). See
  [2026-07-06-web-split-use-player](sessions/2026-07-06-web-split-use-player.md).
- **Prior — Lot E trio done (2026-07-06)** on branch `refactor/web-complexity-debt`
  (off `main`, D.3 merged as PR #63): **the first half of Lot E** (dette de
  complexité) — three small behaviour-preserving refactors in one PR.
  **(E.2)** a single-source-of-truth `isSyntheticStem` predicate
  ([synthetic-stem.ts](../packages/web/src/app/mixer/synthetic-stem.ts)) for the
  two mixer channels that aren't part of a saved separation (metronome + un-split
  « Piste »); `separationMixer()` filters on it instead of an inline dual-id
  compare. **(E.3)** the inline `onSeparate` arrow lifted out of the JSX into a
  named `handleSeparate` on the shell. **(E.4)** dropped the no-op
  `.map((channels) => channels)` in `mixer.spec`. Note: E.2's flagged
  duplication was already dissolved by prior slices — only the combined filter
  site remained to collapse. Gate **green — 587 tests**, coverage 95.76 %/88.7 %
  (unchanged), **jscpd 5 clones** (unchanged); mutation **skipped** (core
  production code untouched — E.4 edits a test file). **Next: E.1** — split
  [use-player.ts](../packages/web/src/app/waveform/use-player.ts) (366 lines) on
  its own branch. See
  [2026-07-06-web-complexity-debt-trio](sessions/2026-07-06-web-complexity-debt-trio.md).
- **Prior — Lot D.3 done (2026-07-06)** on branch `feat/web-feedbacks` (off `main`,
  C.4/C.5 merged as PR #60/#61): **the missing feedbacks** — web-only bar one core
  re-export. Three silent moments now confirm themselves, on a new reusable
  success-toast primitive. (1) **Unsupported-URL guard**: `isSupportedSourceUrl` is
  now on the core's public surface ([index.ts](../packages/core/src/index.ts)); the
  URL-import popover ([import-menu.tsx](../packages/web/src/app/header/import-menu.tsx))
  shows an inline `role="alert"` warning + `aria-invalid` and **disables submit**
  for a non-supported host — the same predicate the use-case rejects on, so no
  doomed request leaves (replaces the old submit→error-banner round-trip).
  (2) **Toast primitive** on **Base UI Toast**: [use-toaster.ts](../packages/web/src/app/ui/use-toaster.ts)
  owns a **per-instance** manager (`createToastManager`, not a global singleton →
  no cross-test leak) + `notifySuccess`; [toast-region.tsx](../packages/web/src/app/ui/toast-region.tsx)
  renders a fixed bottom-right viewport, neutral elevated card, a new **`check`**
  glyph ([icon.tsx](../packages/web/src/app/ui/icon.tsx)) carrying "success" (no new
  colour — teal stays "detected"), C.5 `data-starting/ending-style` transitions.
  Errors keep `AlertBanner`; toasts are the quiet "it worked" channel.
  (3) **Export + save confirm**: `exportStems`/`downloadStem` return a success
  boolean ([use-separation.ts](../packages/web/src/app/separation/use-separation.ts));
  new [use-stem-export.ts](../packages/web/src/app/workstation-shell/use-stem-export.ts)
  hook toasts « Stems exportés »/« Fichier exporté », and `useProjectSession`'s new
  `onSaved` toasts « *« Nom » enregistré* ». Extracting the export handlers also
  cleared a `react-doctor` "large component" warning on `WorkstationShell`. Gate
  **green — 582 tests**, coverage **95.75 %/95.62 %** (up from 94.8 %), **jscpd 5
  clones** (unchanged); mutation **skipped** (only a core re-export, no new logic).
  **Browser-verify still pending — no Chrome on this WSL2 box, to run on the Mac**
  (Spotify-URL warning, export/save toasts, reduced-motion). **D.1 (undo/redo)
  deprioritised** this session (low value for the effort). **Next: browser-verify →
  merge, then D.2** (« Séparer » ↔ server health). See
  [2026-07-06-web-feedbacks](sessions/2026-07-06-web-feedbacks.md).
- **Prior — Lot D.2 done (2026-07-06)** on branch `feat/web-separate-server-health`
  (off `main`, Lot C complete + merged through PR #61): **« Séparer » câblé à la
  santé serveur** — web-only, no core. The `ServerHealth`
  (`checking`/`offline`/`no-separation`/`ready`) already computed for the header
  chip now threads down to `SeparationPanel` via `ShellMain` (new `serverHealth`
  prop on both). The « Séparer » button **disables** on `offline`/`no-separation`
  (a `SERVER_BLOCK` descriptor table) and shows an **actionable hint** in place of
  the old click → wait → error (« Serveur hors ligne — démarrer le serveur
  local… » / « Ce serveur ne fournit pas de moteur de séparation. »); the idle
  hint is hidden when a server block shows. `checking` stays enabled (transient at
  boot — disabling would flash the button off/on). 2 new Lingui ids
  (`separation.server-offline/-no-separation`, extracted), 3 specs (offline /
  no-separation / checking). Gate **green — 576 tests**, jscpd 5 clones
  (unchanged), sheriff/design/dead green; mutation **skipped** (no core).
  react-doctor **green** (v0.7.1) — a mid-session phantom « 1 a11y warning » was a
  stale `node_modules` (drifted to react-doctor 0.5.8 vs the lockfile's 0.7.1);
  `pnpm install` reconciled it, lockfile unchanged.
  **Browser-verify pending on the Mac** (server off → greyed + offline hint;
  torch-less server → no-engine hint; ready → enabled). **D.1 undo/redo deferred
  to « veille »** (product call: low ROI for a practice tool — editable state
  trivial to redo by hand, mixer is a live control surface). **Next: D.3**
  (missing feedbacks). See
  [2026-07-06-web-separate-server-health](sessions/2026-07-06-web-separate-server-health.md).
- **Prior — Lot C.5 done (2026-07-05)** on branch `feat/web-overlay-micromotion`
  (off `main`, C.4 merged as PR #60): **micro-motion for the overlays** — CSS-only,
  no core, no new component. New **motion tokens** in
  [tokens.css](../packages/web/src/styles/tokens.css) (`--motion-fast:130ms` light
  popovers / `--motion-med:180ms` dialog+banner / `--motion-ease` ease-out); the
  existing global `prefers-reduced-motion` reset already neutralises them, so no
  per-rule guard. **Dialogs** ([app-dialog.module.css](../packages/web/src/app/ui/app-dialog.module.css),
  shared by projects/shortcuts/confirm-import): backdrop **fades**, popup
  **fades+scales `0.96→1`** via Base UI `data-starting/ending-style`, keeping the
  centring `translate(-50%,-50%)` in every state. **Popovers/menu**: a shared
  `.motion` class in [popover-form.module.css](../packages/web/src/app/ui/popover-form.module.css)
  (fade + `translateY(-4px)`) `composes:`d by the rename/URL forms **and** the
  import menu — defined once, jscpd flat. **Alert banner** (a plain mounted div, not
  a Base UI overlay): entrance-only `@keyframes alert-in` slide-down+fade. Gate
  **green — 573 tests**, coverage unchanged (94.89 %/87.29 %), **jscpd 5 clones**
  (unchanged); mutation skipped (no core). **Browser-verified** offline: dialog
  transition `0.18s`, popover `0.13s`, and the **exit is animated then unmounts
  cleanly** (dialog stays mounted through the 180ms exit, gone after 400ms — no
  stuck-overlay). Left un-animated on purpose: the live drag drop-overlay, and the
  banner's exit. **Lot C is essentially complete (C.1–C.5); next: Lot D** (D.1
  undo/redo, D.2 « Séparer »↔server health, or D.3 missing feedbacks). See
  [2026-07-05-web-overlay-micromotion](sessions/2026-07-05-web-overlay-micromotion.md).
- **Prior — Lot C.4 done (2026-07-05)** on branch `feat/web-unify-buttons-icons`
  (off `main`): **unify the button system + an inline SVG icon set** — CSS-only +
  one small presentational component, no core. The header stopped re-defining its
  own amber/ghost faces: `.primaryAction` now `composes: amberButton`,
  `.iconAction` `composes: ghostButton` (from the shared
  [controls.module.css](../packages/web/src/app/ui/controls.module.css)); only the
  genuinely distinct `.secondaryAction` (neutral outlined) and `.confirmAction`
  (destructive import step) stay local. The per-button `:focus-visible` blocks in
  **both** header and transport were deleted — byte-for-byte copies of the global
  `:focus-visible`/`[data-on-amber]` baseline — removing the shared CSS clone. New
  [icon.tsx](../packages/web/src/app/ui/icon.tsx): a 24×24 `currentColor`,
  `aria-hidden`, `em`-sized `Icon` (filled transport marks + stroked
  edit/close/loop) replaces every fragile text glyph (`⏮ ▶ ⏸ ⏭ ✎ ✕ ⟳`) across
  transport-bar, header, alert-banner, analysis-panel and loop-controls; the `⟳`
  left the Lingui `loops.active`/`inactive` messages (catalog re-extracted). a11y
  intact (hosts keep their labels; the loop toggle's name stays « Boucle active »).
  Gate **green — 573 tests**, coverage unchanged (94.89 %/87.29 %), **jscpd 6 → 5
  clones**; mutation skipped (no core). **Browser-verified** offline (transport
  icons crisp, header reads as one system, all 7 glyphs render). Left as text on
  purpose: header `?` and zoom `−`/`+` (outside C.4's scope). **Next: Lot C.5**
  (overlay micro-motion). See
  [2026-07-05-web-unify-buttons-icons](sessions/2026-07-05-web-unify-buttons-icons.md).
- **Prior — Lot C.3 done (2026-07-05)** on branch `feat/web-design-system-tokens`
  (off `main`): the **design-system completion** — CSS-only, no core. Added to
  [tokens.css](../packages/web/src/styles/tokens.css) and propagated: an **8-step
  modular type scale** (`--font-size-2xs…2xl`) replacing all **62** hard-coded rem
  `font-size` declarations (17 near-duplicate literals consolidated, ≤1px shifts,
  user chose consolidation over faithful aliasing); **elevation** `--shadow-1`
  (menus/popovers) / `--shadow-2` (dialogs) — dialogs/popovers had *no* shadow
  before; a **z-index scale** `--z-playhead:10 / overlay:20 / dialog:30 /
  popover:40`; and a **radius scale** `--radius-xs/s/(6px)/l/pill` (only three
  `50%` round ratios left). A **user-reported z-index regression** surfaced the
  real Base UI gotcha: in `Portal > Positioner > Popup`, z-index must sit on the
  **Positioner** (positioned) — the Popup is `static` so its z-index is inert; a
  shared `.positioner` class fixes the « Renommer »-behind-projects-dialog stack.
  Gate **green — 573 tests**, coverage unchanged (94.88 %/87.29 %),
  `check:design` green; mutation skipped (no core). Browser-verified offline
  (dialog shadow + Positioner `z-index:40` over dialog `30`); the server-backed
  projects-rename flow is left to re-test with the server up. **Next: Lot C.4**
  (unify buttons + inline SVG icons).
  See [2026-07-05-web-design-system-tokens](sessions/2026-07-05-web-design-system-tokens.md).
- **Prior — Lot C.2 done (2026-07-05)** on branch `feat/web-responsive-tactile`
  (PR #58, stacked on C.1 `feat/web-dnd-empty-state`, PR #57): the **responsive &
  tactile pass**, CSS-only (no core), done the **Every Layout way — intrinsic, not
  breakpoint-driven**. Starting point: one layout media query (900px), every touch
  target 18–36px. Now the app has **zero viewport media queries**: the **header**
  and **transport bar** reflow via `Cluster` (`flex-wrap`); the body two-column ⇄
  stacked flip is an Every Layout **Sidebar** (the panel keeps `--panel-width`
  beside the main via `flex-basis` and wraps below once the main can't hold its
  60 % `min-inline-size` — geometry reproduces the old 900px collapse at ~888px);
  the track gutter is fluid `clamp(132px, 40vw, 200px)` and page padding
  `clamp(space-s, 2.5vw, space-l)`. The only query left is the **`(pointer:
  coarse)`** feature query for tap-target sizing (an input-modality signal, no
  intrinsic equivalent): 44px hit areas via two composable `::after` expanders in
  `controls.module.css` (`touchTarget` 44×44; `touchTargetTall` 44px-tall for the
  tight gutter). Gate **green — 573 tests**, coverage unchanged (94.88 %/87.29 %),
  **jscpd 7 clones**; mutation skipped (no core). **Browser-verified** across
  360/700/880/1000/1440px: page horizontal overflow **0** everywhere; Sidebar
  flips to stacked at ~888px; coarse-pointer transport/header controls measured at
  44×44. **Next: Lot C.3** (design system — typo/elevation/z-index).
  See [2026-07-05-web-responsive-tactile](sessions/2026-07-05-web-responsive-tactile.md).
- **Prior — Lot C.1 done (2026-07-05)** on branch `feat/web-dnd-empty-state` (off
  `main`): the first visible win of Lot C. **Native OS-file drag-and-drop** +
  a real first-run **empty-state** hero, no DnD library. After weighing the
  widget-DnD libs (they don't solve OS file drop) and `react-dropzone` (a dep for
  ~40 lines), chose the native API: a pure `pick-audio-file` guard + humble
  `use-file-drop` (dragenter/leave depth counter) → the picker's exact import
  path (`session.importPickedFile`); a full-viewport drop overlay; a drop-confirm
  **dialog** for unsaved work (a one-shot drop can't ride the header's two-step);
  and an `EmptyState` (dashed drop-zone, format hint, « Importer » CTA, live
  keyboard layout) shown while `idle` — `loading`/`error`/`loaded` keep the
  workstation. Extracted `ShellDropLayer` + `useSeparateAndLoad` to keep the shell
  under the maintainability threshold. Gate **green — 573 tests**, coverage web
  94.88 %/87.29 %, react-doctor 0; mutation skipped (no core). Browser-verified
  end-to-end (drop imports; overlay + confirm show). Pre-existing project-reopen
  test flake noted (present on `main` too). **Next: Lot C.2** (responsive/tactile).
  See [2026-07-05-web-dnd-empty-state](sessions/2026-07-05-web-dnd-empty-state.md).
- **Prior — durcissement & excellence roadmap (2026-07-05)**: after a four-axis
  evaluation (fonctionnalité / qualité / UX-UI / sécurité), a guiding plan landed
  at [roadmap-excellence.md](roadmap-excellence.md) — 5 lots (A sécurité serveur,
  B discipline serveur, C fossé produit, D fonctionnalités, E dette), PR-sized
  slices, `main` doc-only. **Lot A.1 done (PR #48, merged)**: removed the
  🔴 critical runtime `pip install -U yt-dlp` from the download path
  (attacker-triggerable RCE) — see
  [2026-07-05-server-no-runtime-pip](sessions/2026-07-05-server-no-runtime-pip.md).
  **Lot A.2 done** on branch `fix/server-cors-host` (PR #49): scoped CORS to the dev origin
  (`LOUPE_ALLOWED_ORIGINS`) + `TrustedHostMiddleware` (`LOUPE_ALLOWED_HOSTS`)
  against DNS-rebinding — no more wildcard CORS on the unauthenticated localhost
  server. Server pytest **21 passed**, verified on real uvicorn (foreign origin
  gets no CORS header, bad Host → 400); gate green, mutation skipped (no core).
  **Lot A.3 done** on branch `fix/server-resource-limits` (PR #50): body-size caps
  (reject before buffering) on `/audio`/`/separate`/`/tempo`/manifests, a bounded
  `/separate` concurrency semaphore, a hardened stem temp dir (new torch-free
  `stems_store`: 0700 dirs + age TTL sweep + path validation), and generic
  client-facing errors (full detail logged server-side). Server pytest **36
  passed**; verified on real uvicorn (2 MB over a 1 MB cap → 413, malformed
  `/stems` → 404, jobs dir 0700). Gate green, mutation skipped (no core).
  **Lot A.4 done — Lot A COMPLETE** on branch `fix/server-loopback-and-filename` (PR #51):
  `LoopbackOnlyMiddleware` (torch-free `netguard`) refuses non-loopback requests at
  the socket level (a `--host 0.0.0.0` mistake can't reach the LAN even with a
  forged Host), and web `exportBaseName` strips path-sep/reserved/control chars
  from download filenames. Server pytest **49 passed**, web **548 passed**;
  loopback flow verified 200 on real uvicorn. Gate green, mutation skipped.
  **Lot B started (pyright, not mypy; +B.3 humble-object convention). Lot B.1
  done** on branch `test/server-pytest-breadth` (PR #54): broadened server pytest —
  `projects.py` **100 %**, `main.py` **100 %**, `download.py` **86 %** (target ≥80 %
  met), via torch-free minimal-app / fake-`_extract` / `sys.modules`-hidden-ML
  tests; **70 passed, 79 % total**. `separation`/`tempo` stay low by design (torch/
  librosa humble objects). See
  [2026-07-05-server-pytest-breadth](sessions/2026-07-05-server-pytest-breadth.md).
  **Lot B.2 done** on branch `ci/server-lint-types-ci` (PR #55): the server now has its own
  **blocking gate, run torch-free** — `pyproject.toml` (ruff + pyright-basic +
  pytest/coverage 80 % floor), a new **`server` CI job** (ruff → format → pyright →
  pytest), pinned `requirements.txt` + a light torch-free `requirements-dev.txt`.
  The ML humble objects (`separation`/`tempo`) are excluded from pyright+coverage
  and covered manually. Validated in a throwaway torch-free venv: **70 passed,
  94.96 %**, pyright **0 errors**. The last structural gap (server outside CI) is
  closed. See
  [2026-07-05-server-lint-types-ci](sessions/2026-07-05-server-lint-types-ci.md).
  **Lot B.3 done — Lot B COMPLETE** on branch `refactor/server-humble-objects` (PR #56):
  extracted the last testable logic from the ML shells — new torch-free
  `stem_manifest` (source ordering + id/label/url) and `download.progress_fraction`
  — and wrote the **humble-object convention** into `server/README.md`. Server
  **80 passed, 96.83 %** (download 90 %, `stem_manifest` 100 %), pyright 0 errors.
  Behaviour-preserving (unit-proven), so no full separation re-run. **Next: Lot C**
  (produit) — **C.1** DnD + empty-state, the first visible win. Also **held**:
  Dependabot **PR #53** (`@vitejs/plugin-react` v6, breaking Babel→oxc) deferred —
  see roadmap « Reporté / veille ». See
  [2026-07-05-server-humble-objects](sessions/2026-07-05-server-humble-objects.md).
- **Prior — housekeeping pass (2026-07-05)**: four user asks on one branch
  `refactor/dry-tabs-coverage`. **(1) DRY** — knip already clean; jscpd **14 → 7
  clones, 1.26 % → 0.68 %** by extracting the real duplication: pure TDD-tested
  `lib/pointer-ratio.ts` (the waveform/marker-rail `clientX→0–1` map),
  `audio/web-audio-shared.ts` (`audioBufferFrom` + `loadSoundTouchNode`, shared by
  both playback engines; dead `applyParams` dropped), and `app/ui/controls.module.css`
  (three button skins `amberButton`/`ghostButton`/`quietButton` that five files now
  `composes:` instead of copy-pasting). **(2) Tabs** — the analysis-panel sidebar
  tabs get hover/focus/transition + an underline pulled onto the list baseline.
  **(3) UI patterns → `app/ui/`** — `controls.module.css` is the concrete home;
  `EntryRow`/`.label`/app-bar noted as single-use, not extracted. **(4) Coverage
  gated** — new **85/80** threshold on `packages/web/src/**`; the untestable Web
  Audio humble objects + composition roots are *excluded* (jsdom can't drive them,
  verified in-browser), lifting the measured figure **~81 % → 94.8 %**. Gate green,
  **542 tests**, web build green (confirms `composes:` resolves); mutation skipped
  (core untouched). PR to open. See
  [2026-07-05-dry-tabs-coverage](sessions/2026-07-05-dry-tabs-coverage.md).
- **Now — UI clarity pass (2026-07-04)**: user-driven polish on the workstation
  before the next roadmap slice, three refactors on one branch
  `refactor/ui-workstation-clarity`. **(1) Mix legibility** — the main « Mix »
  lane draws **one summed envelope** (the unused pure `combineWaveforms`,
  gain-weighted so mute/solo reshape it live) instead of stacking every stem as
  a translucent overlay; the per-stem lanes stay below. **(2) Saved loops →
  sidebar** — split the loop bar: live A/B controls stay inline (`LoopControls`),
  the saved-loop library becomes a « Boucles » tab beside « Repères » (shared
  `EntryRow`); fills the half-empty sidebar and makes loops/markers consistent
  siblings. **(3) Separation relocated** — the « Séparer » action + progress move
  to the top (import moment) and step aside once ready; the « Non détectés »
  caption moves into the mixer gutter (new `UndetectedStems`). Gate green, **537
  tests**; mutation **skipped** (core untouched — `combineWaveforms` pre-existed).
  #1 browser-verified by the user; #2/#3 report+PR first. **PR #46 opened.** See
  [2026-07-04-ui-workstation-clarity](sessions/2026-07-04-ui-workstation-clarity.md).
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
  active-loop fix + UX session state). **Jalon 3 polish is complete (2026-07-04)
  — all three merged + browser-verified**: `separator-server/` → `server/` rename
  (PR #43), rename a saved project (PR #44), and blob GC (PR #45, rebased onto the
  renamed `server/`). See
  [2026-07-04-jalon3-polish](sessions/2026-07-04-jalon3-polish.md).
- **Now — metronome-persistence slice (2026-07-04)**: the detected tempo +
  metronome now **persist with the project**. New pure `ProjectTempo`
  (`bpm` + downbeat-flagged `BeatGrid` + the metronome's `MixerChannel`) on
  `Project`/`SessionSnapshot`, threaded through `projectFromSession`/`saveProject`;
  reopening restores the grid, BPM read-out and click **without the server** (the
  click PCM is re-synthesised). The metronome now seats **muted by default** on a
  fresh detection (unlike other voices); persistence wins over the default. The
  **open owns tempo/metronome seating** — a one-shot suppress flag makes the shell
  auto-detect import-only (also fixing a latent open-path race where auto-detect
  could clobber restored stems); old manifests detect fire-and-forget so
  « ouverture » never hangs on the server. `sessionSignature` signs the metronome
  settings with a default-muted neutraliser so a reopened project reads
  « Enregistré ». High-effort review fixed 4 items (phantom masked-stem channels,
  live/saved signature asymmetry, BPM-over-empty-mixer on a failed rebuild,
  suppress-latch on the superseded return). **Browser-verified end-to-end**: import
  → 120 BPM + muted click, unmute + save (manifest holds bpm + 23-beat grid +
  `metronome{muted:false}`), reopen → restored un-muted with **zero second
  `/tempo` call** (network-traced). Gate green, **493 tests**, core mutation
  94.25 % (`project.ts` 100 %). **Merged (PR #41), browser-verified on the Mac.**
  See
  [2026-07-04-metronome-persistence](sessions/2026-07-04-metronome-persistence.md).
- **Now — import-from-url slice (2026-07-04), FULL vertical slice**: import a track
  from a media **URL** (YouTube / SoundCloud). Core (prior session): driven port
  **`TrackSource`** + use-case **`importFromUrl`** + policy **`isSupportedSourceUrl`**.
  **This session** landed the adapter, server and UI:
  - **Web adapter `createHttpTrackSource`** speaks the NDJSON contract
    (`POST /download {url}` → progress → `GET /audio/{ref}`); a generic
    **`streamNdjson`** now backs both the download and separation adapters (the
    duplicated stream loop removed).
  - **Server `download.py`**: yt-dlp on a worker thread → NDJSON (mirrors
    `/separate`), `bestaudio[ext=m4a]` (no ffmpeg), host allowlist mirroring the
    core, auto-retry + `pip -U yt-dlp` on failure, bytes parked via the shared
    `projects.store_audio()`. Lazy-imported with an NDJSON-error fallback; app
    builds + serves the fallback with yt-dlp absent (verified).
  - **UI — « Menu sur Importer »** (approach confirmed with the user): a menu
    (« Fichier… » / « Depuis une URL… ») on the import trigger; the URL item opens
    a link popover. Guard on menu-open (one « Confirmer ? » covers both paths).
    `useImportFromUrl` hook → `session.importDownloaded` (reuses the file-decode
    path via a `File`). Download progress narrated in the header **state chip**,
    errors via the **AlertBanner**. Built on Base UI **Popover** (Menu doesn't
    drive under jsdom). Popover-form CSS deduped into `popover-form.module.css`.
  - Gate green, **527 tests**; mutation **skipped** (core untouched this session).
  **Browser-verified end-to-end** (Mac, yt-dlp 2026.06.09 in the venv): « Depuis
  une URL… » → « Me at the zoo » loaded (artist « jawed » from the uploader, 0:19,
  waveform, tempo 117 BPM), network all 200, console clean. **PR being opened**.
  On branch `feat/import-from-url`. See
  [2026-07-04-import-from-url-adapter-ui](sessions/2026-07-04-import-from-url-adapter-ui.md)
  and [2026-07-04-import-from-url-core](sessions/2026-07-04-import-from-url-core.md).
- **Earlier — metronome-stem slice (2026-07-04, merged PR #40)**: the metronome as a configurable
  mixer stem, built on tempo detection. Pure `synthesizeClickTrack` (click PCM
  from a `BeatGrid`, accented downbeats) + mixer `addChannel`/`removeChannel` +
  `StemPlaybackEngine.addStem`/`removeStem`. The click rides the mixer like any
  stem (lane, colour, dB fader, mute/solo, WAV) and follows tempo. UX iterated
  live with the user: **tempo auto-detected on import** (no button), the stem
  **auto-shown once the tempo is known** (no toggle), the **beat grid toned
  down**, and the **mix drawn per-voice in colour + transparency** (not one
  amber envelope). Un-separated = « Piste » + « Métronome » two-lane mix.
  Browser-verified (incl. the « separating hid the stems » regression fixed via
  a single-pass `attach`). Gate green, **478 tests**, core mutation 94.22 %.
  **PR to open, stacked on PR #39.** See
  [2026-07-04-metronome-stem](sessions/2026-07-04-metronome-stem.md).
- **Earlier — real tempo detection slice (2026-07-03)**: a full hexagonal vertical
  slice, server-side (`librosa`) per the locked decision. Pure core: driven
  port `TempoDetector` + `detectTempo` use-case + pure `buildBeatGrid`
  (downbeat-flagged `BeatGrid`, `DEFAULT_BEATS_PER_BAR = 4`). Web:
  `createHttpTempoDetector` (`POST /tempo` → `{ bpm, beats }`), `useTempo` hook
  (run-id guard, reset on fresh track), a `TempoPanel` (« Détecter le tempo » →
  « NNN BPM ») and a **beat-grid overlay** on the waveform (downbeats stronger).
  Server: new `app/tempo.py` running librosa's beat tracker off the event loop,
  lazy/optional like separation (503 without librosa). Found & fixed a real
  server bug (median onset aggregation collapsed the estimate to 0 BPM at
  44.1 kHz → compute the mean onset envelope explicitly). High-effort review
  fixed 3 items (JSON validation, event-loop block, unused `Beat` export). Gate
  green, **463 tests**, core mutation 95.75 % (`tempo.ts`/`detect-tempo.ts`
  100 %). DSP validated locally on synthetic clicks; **browser-verify pending on
  the Mac.** See
  [2026-07-03-tempo-detection](sessions/2026-07-03-tempo-detection.md).
- **Earlier — tempo/pitch/zoom persistence slice (2026-07-03, merged)**: the playback
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
  95.79 % (`project.ts` 100 %). **Merged (PR #38), browser-verified on the
  Mac.** See
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
- **Branch**: `main` — `feat/metronome-persistence` **merged (PR #41)**.
  Earlier: `feat/metronome-stem` **merged (PR #40)**;
  `feat/tempo-detection` **merged (PR #39)**; `feat/persist-tempo-pitch-zoom` **merged (PR #38)**;
  `feat/i18n-messages` **merged (PR #37)**; `feat/dirty-session-guard`
  **merged (PR #36)**; `feat/ui-polish` **merged (PR #35)**.
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

**Pick the next slice.** Jalon 3 polish is fully merged + browser-verified (PRs
#43/#44/#45); the local venv now lives at `server/.venv`. Candidates by user
value:
- UX backlog: speed trainer, undo.
- Perf: off-thread zip/encode — the export measurably freezes the UI a few
  seconds on a 4-min track (main-thread encode+zip, ~229 MB).
- **Jalon 4**: export MIDI per stem (basic-pitch), starting bass + monophonic —
  the headline audio→notation differentiator.

Small follow-up from the polish batch: no UI trigger for GC yet (runs on server
boot + `POST /gc`) — add a button only if wanted.
- Follow-up (small, documented): old *separated* manifests re-`attach` stems on
  the fire-and-forget detect, reverting fader edits made in the detection window
  — self-heals on save; fix only if it bites.

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
| J4.1 | Import from a media URL (YouTube / SoundCloud) — `TrackSource` port + `importFromUrl` (core) + HTTP adapter + yt-dlp server + « Menu sur Importer » UI. Merged (PR #42) | ✅ |
| J3.5 | Jalon 3 polish — `separator-server/` → `server/` rename (#43), rename a saved project (#44), blob GC (#45). Merged + browser-verified | ✅ |

## Session journal

Dated reports under [docs/sessions/](sessions/). Most recent on top.

- [2026-07-06 — web-separate-server-health](sessions/2026-07-06-web-separate-server-health.md) —
  Lot D.2: « Séparer » wired to server health (web-only, no core). The
  `ServerHealth` already computed for the header chip threads to `SeparationPanel`
  via `ShellMain` (new `serverHealth` prop). The button **disables** on
  `offline`/`no-separation` and shows an **actionable hint** instead of the old
  click → wait → error; `checking` stays enabled (no boot flash); the idle hint is
  hidden under a server block. 2 Lingui ids (extracted), 3 specs. Gate green,
  576 tests, jscpd 5 (unchanged); mutation skipped (no core). react-doctor 0 real
  findings (score-API phantom on this WSL2 PC — CI/Mac green). Browser-verify
  pending on the Mac. **D.1 undo/redo deferred to « veille »** (low ROI for a
  practice tool). PR to open on `feat/web-separate-server-health`.
- [2026-07-05 — web-overlay-micromotion](sessions/2026-07-05-web-overlay-micromotion.md) —
  Lot C.5: micro-motion for the overlays (CSS-only, no core). Motion tokens
  (`--motion-fast`/`med` + ease-out) in `tokens.css`; the global
  `prefers-reduced-motion` reset neutralises them (no per-rule guard). Dialog:
  backdrop fade + popup fade/scale `0.96→1` via Base UI `data-starting/ending-style`,
  centring transform preserved (shared by projects/shortcuts/confirm-import).
  Popovers + import menu: a shared `.motion` class `composes:`d once (fade +
  `translateY(-4px)`), jscpd flat. Alert banner: entrance-only `@keyframes` slide+fade.
  Gate green, 573 tests, coverage unchanged, jscpd 5 clones (unchanged); mutation
  skipped (no core). Browser-verified: transitions apply (dialog 0.18s, popover
  0.13s) and the dialog exit animates then unmounts cleanly (no stuck overlay). PR
  to open on `feat/web-overlay-micromotion`.
- [2026-07-05 — web-unify-buttons-icons](sessions/2026-07-05-web-unify-buttons-icons.md) —
  Lot C.4: unify the button system + inline SVG icons (CSS + one presentational
  component, no core). Header stops re-defining amber/ghost — `.primaryAction`
  composes `amberButton`, `.iconAction` composes `ghostButton`; only the distinct
  `.secondaryAction`/`.confirmAction` stay local. Per-button `:focus-visible`
  blocks in header + transport deleted (global-baseline duplicates), killing the
  shared CSS clone. New `Icon` (24×24 `currentColor`, `aria-hidden`, `em`-sized;
  filled transport marks + stroked edit/close/loop) replaces the text glyphs
  `⏮ ▶ ⏸ ⏭ ✎ ✕ ⟳` across transport/header/alert/analysis/loop; `⟳` left the Lingui
  loop messages (re-extracted). a11y preserved. Gate green, 573 tests, jscpd
  6 → 5; mutation skipped (no core). Browser-verified. PR to open on
  `feat/web-unify-buttons-icons`.
- [2026-07-05 — dry-tabs-coverage](sessions/2026-07-05-dry-tabs-coverage.md) —
  Housekeeping pass (one branch) from four user asks. **DRY**: jscpd 14 → 7 clones
  (1.26 % → 0.68 %) via `lib/pointer-ratio.ts` (TDD), `audio/web-audio-shared.ts`
  (`audioBufferFrom` + `loadSoundTouchNode`), and `app/ui/controls.module.css`
  (`amberButton`/`ghostButton`/`quietButton` composed by five files). **Tabs**:
  analysis-panel sidebar tabs get hover/focus/transition + baseline-aligned
  underline. **UI patterns**: `controls.module.css` is the shared home;
  `EntryRow`/`.label`/app-bar noted, not extracted (single-use). **Coverage**: web
  gated at 85/80, untestable Web Audio adapters + composition roots excluded → 81 %
  → 94.8 %. Gate green, 542 tests, web build green; mutation skipped (core
  untouched). PR to open on `refactor/dry-tabs-coverage`.
- [2026-07-04 — ui-workstation-clarity](sessions/2026-07-04-ui-workstation-clarity.md) —
  User-driven UI clarity pass, three refactors on one branch. **(1)** Main « Mix »
  lane = one summed `combineWaveforms` envelope (gain-weighted, live to mute/solo)
  instead of stacked translucent stems; lanes stay below. **(2)** Saved loops move
  to a « Boucles » sidebar tab (shared `EntryRow` with markers); live A/B controls
  stay inline as `LoopControls`; `loop-bar` → `loop-controls`. **(3)** Separation
  action + progress relocate to the top of the column and step aside once ready;
  the « Non détectés » caption moves into the mixer gutter (`UndetectedStems`).
  Gate green, 537 tests, mutation skipped (core untouched). #1 browser-verified by
  the user. PR #46 on `refactor/ui-workstation-clarity`.
- [2026-07-04 — jalon3-polish](sessions/2026-07-04-jalon3-polish.md) —
  The three deferred Jalon 3 polish items, each its own branch/PR.
  **(1) `separator-server/` → `server/` rename** (#43): the backend outgrew its
  name; `git mv` + in-place venv-path patch + config/README updates. **(2) Rename
  a saved project** (#44): thin slice — core `renameProject` (load → trim → save,
  refs untouched, no server change), `useProjects.rename`, a « Renommer »
  `NameEditor` popover per row (reuses the loop/marker rename popover); mutation
  killed all 24 of its mutants. **(3) Blob GC** (#45): server-side manifest-scan
  `collect_garbage` (schema-agnostic — any sha256-shaped string is a live ref;
  conservative — aborts if a manifest is unreadable), `POST /gc` + a lifespan boot
  sweep; new pytest infra (6 GC cases), live-verified. Gates green. PRs open, not
  yet merged.
- [2026-07-04 — import-from-url-adapter-ui](sessions/2026-07-04-import-from-url-adapter-ui.md) —
  The adapter + server + UI half of J4.1, making it a full vertical slice. Web
  `createHttpTrackSource` (NDJSON `POST /download` → `GET /audio/{ref}`) on a new
  shared generic `streamNdjson` (separation adapter refactored onto it too).
  Server `download.py` runs yt-dlp on a worker thread → NDJSON, `bestaudio[ext=m4a]`
  (no ffmpeg), host allowlist, auto-retry + `pip -U yt-dlp` on failure, bytes via
  the shared `store_audio()`; lazy with an NDJSON-error fallback. UI: « Menu sur
  Importer » (Fichier… / Depuis une URL…) on a Base UI Popover, guard on menu-open,
  `useImportFromUrl` → `session.importDownloaded` (reuses the file-decode path),
  progress in the state chip, errors in the AlertBanner; popover-form CSS deduped.
  Gate green, 527 tests, mutation skipped (core untouched). Real yt-dlp
  browser-verify + PR pending. On `feat/import-from-url`.
- [2026-07-04 — import-from-url-core](sessions/2026-07-04-import-from-url-core.md) —
  Core slice: `TrackSource` port + `importFromUrl` use-case + `isSupportedSourceUrl`
  policy. yt-dlp over play-dl; NDJSON + content-addressed store + m4a/AAC contract
  fixed. Gate green, 512 tests, core mutation 94.52 % (both new files 100 %).
- [2026-07-04 — metronome-persistence](sessions/2026-07-04-metronome-persistence.md) —
  The detected tempo + metronome persist with the project. Pure `ProjectTempo`
  (bpm + beat grid + the metronome's mixer settings) on `Project`; reopen restores
  the grid/BPM/click with **no server** (the click is re-synthesised). The click
  seats **muted by default** (persistence wins over it); the open owns
  tempo/metronome seating via a one-shot suppress flag (also fixing a latent
  auto-detect-clobbers-stems race); old manifests detect fire-and-forget. Signature
  neutralises an absent metronome to default-muted → reopened projects read
  « Enregistré ». Review fixed 4 items (phantom masked-stem channels, live/saved
  signature asymmetry, BPM-over-empty-mix, suppress latch). Browser-verified:
  import → muted 120 BPM click, unmute+save, reopen → restored un-muted, zero
  second `/tempo`. Gate green, 493 tests, core mutation 94.25 % (`project.ts`
  100 %). PR to open.
- [2026-07-04 — metronome-stem](sessions/2026-07-04-metronome-stem.md) —
  The metronome as a configurable mixer stem (click PCM synthesised from the
  detected `BeatGrid`): its own lane, colour, dB fader, mute/solo, WAV; follows
  tempo on the master bus. Pure `synthesizeClickTrack` + mixer add/remove
  channel + stem-engine add/remove stem. UX iterated live: auto-detect on
  import, auto-shown, faint beat grid, per-voice coloured/transparent mix.
  Browser-verified; « separating hid the stems » regression fixed (single-pass
  `attach`). Gate green, 478 tests, core mutation 94.22 %. PR to open (stacked
  on #39). Follow-up: persistence (`ProjectTempo` + metronome settings).
- [2026-07-03 — tempo-detection](sessions/2026-07-03-tempo-detection.md) —
  UX-backlog slice: real tempo detection, server-side (librosa) behind a new
  `TempoDetector` port. Pure core (`detectTempo` + `buildBeatGrid`), web
  adapter + `useTempo` hook, a `TempoPanel` BPM read-out and a beat-grid
  overlay on the waveform (downbeats stronger). New `app/tempo.py` runs the
  beat tracker off the event loop, lazy/optional (503 without librosa). Fixed a
  real server bug (median onset aggregation → 0 BPM at 44.1 kHz). Review fixed 3
  items. Gate green, 463 tests, core mutation 95.75 % (new files 100 %). DSP
  validated on synthetic clicks; browser-verify pending (Mac). Follow-ups: the
  user-requested metronome stem, and tempo persistence (`ProjectTempo`).
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
